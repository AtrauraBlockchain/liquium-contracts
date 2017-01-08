pragma solidity ^0.4.6;

/*
    Copyright 2016, Jordi Baylina

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


import "Owned.sol";
import "DelegateStatus.sol";

contract PollContractInterface {

    function pollType() constant returns (bytes32);
    function isValid(bytes32 _ballot) constant returns(bool);
    function deltaVote(int _amount, bytes32 _ballot) returns (bool _succes);

}


contract OrganizationInterface {


// Interfce for organization owner
      function addCategory(string _name, uint _parentCategory);
      function removeCategory(uint _idCategory);

      function addVoter(address _voter, string _name, uint _amount) returns (uint _idVoter);
      function removeVoter(uint _idVoter);
      function addPoll(
        string _title,
        uint _closeDelegateTime,
        uint _closeTime,
        uint _categoryId,
        address _pollContractAddr) returns (uint _idPoll);


// Interface for Final Voters
      function vote(uint _idPoll, bytes32[] _ballots, uint[] _amounts, string _motivation);
      function unvote(uint _idPoll);
      function setDelegateSinglePoll(uint _idPoll, uint _delegate);
      function setDelegates(uint[] _categoryIds, uint[] _delegates);

/// Interface for delegates

      function addDelegate(address _delegateAddr, string _name) returns(uint _idDelegate);
      function removeDelegate(uint _idDelegate);


// Query for votes
    function getVoteInfo(uint _idPoll, uint _idUser) constant returns(uint _time, uint _total, uint _nBallots, string _motivation);
    function getBallotInfo(uint _idPoll, uint _idUser, uint _idx) constant returns(bytes32 _ballot, uint _amount);

// Query delegate
    function getPollDelegate(uint _idPoll, uint _idUser) constant returns (uint _idDelegate);
    function getCategoryDelegate(uint _idCategory, uint _idUser) constant returns (uint _idDelegate);


}


contract Organization is OrganizationInterface, Owned {

    uint constant  MIN_TIME_FINAL_VOTING = 86400;
    uint constant  DELEGATE_MODIFICATION_TIME = 3600*4;
    uint constant  DELEGATE_OFFSET = 0x100000000;
    uint constant  USER_ETH_LEVEL = 50 finney;

    struct Category {
        string name;
        bool deleted;
        DelegateStatus delegateStatus;
        uint[] activePolls;
    }

    Category[]  categories;

    struct Vote {
        uint time;
        bytes32[] ballots;
        uint[] amounts;
        string motivation;
        uint total;
    }

    struct Poll {

        string title;

        uint closeDelegateTime;
        uint closeTime;

        uint idCategory;

        PollContractInterface pollContract;
        DelegateStatus delegateStatus;

        bool canceled;

        mapping(uint => Vote) votes;
    }

    Poll[] polls;

    struct Delegate {
        string name;
        address owner;
        bool deleted;
    }

    Delegate[] delegates;
    mapping (address => uint) public delegateAddr2Idx;

    struct Voter {
        string name;
        address owner;
        uint balance;      // Balance to 0 means deleted
    }

    Voter[] voters;
    mapping (address => uint) public voterAddr2Idx;
    mapping (address => uint) lastPaidPoll;

    uint public totalSupply;

    DelegateStatusFactory delegateStatusFactory;

    function Organization(address _delegateStatusFactory) payable {
        delegateStatusFactory = DelegateStatusFactory(_delegateStatusFactory);
        categories.length = 1;
        delegates.length =1;
        polls.length = 1;
        voters.length = 1;
    }


    function addPoll(
        string _title,
        uint _closeDelegateTime,
        uint _closeTime,
        uint _categoryId,
        address _pollContractAddr) onlyOwner returns (uint _idPoll)
    {
        var c = categories[_categoryId];
        if (address(c.delegateStatus) == 0) throw; // Invalid category
        if (c.deleted) throw;
        if (now + MIN_TIME_FINAL_VOTING > _closeTime) throw;
        if (_closeTime < _closeDelegateTime + MIN_TIME_FINAL_VOTING) throw;

        uint idPoll = polls.length++;
        Poll p = polls[idPoll];
        p.title = _title;
        p.closeDelegateTime = _closeDelegateTime;
        p.closeTime = _closeTime;
        p.idCategory = _categoryId;
        p.pollContract = PollContractInterface(_pollContractAddr);
        p.delegateStatus = delegateStatusFactory.createDelegateStatus(c.delegateStatus);

        c.activePolls.push(idPoll);

        PollAdded(idPoll);
    }

    int public test1;
    bytes32 public test2;

    function getUserId(address addr) internal returns(uint _idx) {
        if (voterAddr2Idx[addr]>0) {
            return voterAddr2Idx[addr];
        }
        if (delegateAddr2Idx[addr]>0) {
            return delegateAddr2Idx[addr];
        }
        throw;
    }

    function vote(uint _idPoll, bytes32[] _ballots, uint[] _amounts, string _motivation) {

        Poll poll = _getPoll(_idPoll);

        uint idUser = getUserId(msg.sender);

        if (!canVote(poll, idUser)) throw;

        uint amount = poll.delegateStatus.getVotingPower(idUser);

        uint delegate = poll.delegateStatus.getDelegate(idUser);

        if (delegate != 0) {
            uint finalDelegate = poll.delegateStatus.getFinalDelegate(idUser);

            if ((finalDelegate != 0) && (hasVoted(poll,finalDelegate))) {
                deltaVote(poll, finalDelegate, -int(amount));
            }

            poll.delegateStatus.undelegate(idUser);
        }

        setVote(poll, idUser, _ballots, _amounts, amount, _motivation);

        if (_idPoll > lastPaidPoll[msg.sender]) {
            lastPaidPoll[msg.sender] = _idPoll;
            payUser(msg.sender);
        }
    }


    function unvote(uint _idPoll) {
        Poll poll = _getPoll(_idPoll);

        uint idUser = getUserId(msg.sender);

        if (!canVote(poll, idUser)) throw;

        uint amount = poll.delegateStatus.getVotingPower(idUser);

        if (hasVoted(poll, idUser)) {
            setVote(poll, idUser, new bytes32[](0), new uint[](0), 0, "");
        }

        Category c = categories[poll.idCategory];

        var delegate = c.delegateStatus.getDelegate(idUser);

        if (delegate != 0) {
            poll.delegateStatus.setDelegate(idUser, delegate);
            uint finalDelegate = poll.delegateStatus.getFinalDelegate(idUser);
            if ((finalDelegate != 0)&&( hasVoted(poll,finalDelegate))) {
                deltaVote(poll, finalDelegate, int(amount));
            }
        }
    }

    function setDelegateSinglePoll(uint _idPoll, uint _idDelegate) {
        Poll poll = _getPoll(_idPoll);

        uint idUser = getUserId(msg.sender);

        if (!doSetDelegateSinglePoll(poll, idUser, _idDelegate) ) throw;
    }

    function doSetDelegateSinglePoll(Poll storage poll, uint idUser, uint _idDelegate) internal returns(bool) {

        uint idDelegate = _idDelegate > DELEGATE_OFFSET ?
                                _idDelegate-DELEGATE_OFFSET :
                                _idDelegate;

        if (idDelegate >= delegates.length) return false;

        idDelegate += DELEGATE_OFFSET;

        if (! canVote(poll, idUser) ) return false;

        int amount = int(poll.delegateStatus.getVotingPower(idUser));

        if (hasVoted(poll, idUser)) {
            setVote(poll, idUser, new bytes32[](0), new uint[](0), 0, "");
        }

        poll.delegateStatus.setDelegate(idUser, idDelegate);

        var finalDelegate = poll.delegateStatus.getFinalDelegate(idUser);

        if ((finalDelegate != 0) && (poll.votes[finalDelegate].time != 0)) {
            deltaVote(poll, finalDelegate, amount);
        }

        return true;
    }

    function setDelegates(uint[] _categoryIds, uint[] _delegateIds) {
        uint idUser = getUserId(msg.sender);

        uint i;
        uint j;
        if (_categoryIds.length != _delegateIds.length) throw;
        for (i=0; i<_categoryIds.length; i++) {
            Category c = _getCategory(_categoryIds[i]);

            uint idDelegate = _delegateIds[i];
            if (idDelegate >= DELEGATE_OFFSET) idDelegate -= DELEGATE_OFFSET;

            if (idDelegate >= delegates.length) throw;
            if (delegates[idDelegate].deleted) throw;

            idDelegate = idDelegate + DELEGATE_OFFSET;
            c.delegateStatus.setDelegate(idUser,idDelegate);
            for (j=0; j<c.activePolls.length; j++) {
                Poll p = polls[c.activePolls[j]];
                if (now < p.closeTime ) {
                    if (!hasVoted(p, idUser)) {
                        doSetDelegateSinglePoll(p, idUser, idDelegate);
                    }
                } else {
                    c.activePolls[j] = c.activePolls[c.activePolls.length-1];
                    c.activePolls.length --;
                    j--;
                }
            }
        }
    }


    function canVote(Poll storage poll, uint idUser) internal returns (bool) {
        if (now >= poll.closeTime) return false;
        if (poll.canceled) return false;
        if (isDelegate(idUser)) {
            if (poll.votes[idUser].time != 0) return false;
            if (now >= poll.closeDelegateTime) {
                uint finalDelegate = poll.delegateStatus.getFinalDelegate(idUser);
                if (finalDelegate == 0) return false;
                if (poll.votes[finalDelegate].time == 0 ) return false;
                if (now > poll.votes[finalDelegate].time + DELEGATE_MODIFICATION_TIME) return false;
            }
        } else {
            if (poll.delegateStatus.getVotingPower(idUser) == 0) return false;
        }

        return true;
    }

    function hasVoted(Poll storage poll, uint idUser) internal returns (bool) {
        return poll.votes[idUser].time > 0;
    }





    function setVote(Poll storage poll, uint idUser, bytes32[] ballots, uint[] amounts, uint amount, string motivation) internal {
        uint i;
        int a;
        uint total;

        Vote v = poll.votes[idUser];

        total = 0;
        for (i=0; i<v.ballots.length; i++) {
            total += v.amounts[i];
        }

        for (i=0; i< v.ballots.length; i++) {
            a = int(v.total * v.amounts[i] / total);
            poll.pollContract.deltaVote(-a, v.ballots[i]);
            v.amounts[i] =0;
            v.ballots[i] =0;
        }

        v.ballots.length=0;
        v.amounts.length=0;
        v.total = 0;
        v.time = 0;
        v.motivation = "";

        total = 0;
        for (i=0; i<ballots.length; i++) {
            total += amounts[i];
        }

        if (total == 0) return;
        v.time = now;
        v.motivation = motivation;
        for (i=0; i< ballots.length; i++) {
            v.ballots.push(ballots[i]);
            v.amounts.push(amounts[i]);
            a = int(amounts[i] * amount / total);
            poll.pollContract.deltaVote(a, ballots[i]);
        }
        v.total = amount;
    }

    function deltaVote(Poll storage poll, uint idUser, int amount) internal {
        uint i;
        Vote v = poll.votes[idUser];
        uint total = 0;
        if (amount == 0) return;
        for (i=0; i<v.ballots.length; i++) {
            total += v.amounts[i];
        }
        if (total == 0) return;
        for (i=0; i< v.ballots.length; i++) {
            int a = int(v.amounts[i]) * amount / int(total);
            poll.pollContract.deltaVote(a, v.ballots[i]);
        }
        v.total += uint(amount);
    }

    function _getPoll(uint idPoll) internal returns (Poll storage p) {
        if (idPoll == 0) throw;
        if (idPoll >= polls.length) throw;
        p = polls[idPoll];
    }

    function nPolls() constant returns(uint) {
        return polls.length-1;
    }

    function getPoll(uint _idPoll) constant returns (
            bytes32 _pollType,
            string _title,
            uint _closeDelegateTime,
            uint _closeTime,
            uint _idCategory,
            address _pollContract,
            address _delegateStatus,
            bool _canceled)
    {
        Poll poll = _getPoll(_idPoll);
        _pollType = poll.pollContract.pollType();
        _title = poll.title;
        _closeDelegateTime = poll.closeDelegateTime;
        _closeTime = poll.closeTime;
        _idCategory = poll.idCategory;
        _pollContract = address(poll.pollContract);
        _delegateStatus = address(poll.delegateStatus);
        _canceled = poll.canceled;
    }


    function addVoter(address _voterAddr, string _name, uint _amount) onlyOwner returns (uint _idVoter) {
        uint i;
        uint j;
        address delegate;

        if (_amount == 0) throw;
        if (voterAddr2Idx[_voterAddr] != 0) throw;
        if (delegateAddr2Idx[_voterAddr] != 0) throw;

        uint idVoter = voters.length++;
        Voter v = voters[idVoter];
        v.name = _name;
        v.owner = _voterAddr;
        v.balance = _amount;

        voterAddr2Idx[_voterAddr] = idVoter;
        totalSupply += _amount;

        payUser(_voterAddr);
        VoterAdded(idVoter);
        return idVoter;

    }

    function removeVoter(uint _idVoter) onlyOwner {
        uint i;
        uint j;
        address delegate;

        if ((_idVoter==0)||(_idVoter>=voters.length)) throw;
        Voter v = voters[_idVoter];

        if (v.balance == 0) return;

        for (i=1; i<categories.length; i++) {
            var c = categories[i];
            for (j=0; j<c.activePolls.length; j++) {
                Poll p = polls[c.activePolls[j]];
                if (now < p.closeTime ) {
                    if (p.votes[_idVoter].time != 0) {
                        deltaVote(p, _idVoter, -int(v.balance));
                    }
                } else {
                    c.activePolls[j] = c.activePolls[c.activePolls.length-1];
                    c.activePolls.length --;
                    j--;
                }
            }
        }

        totalSupply -= v.balance;
        v.balance = 0;
        voterAddr2Idx[v.owner] =0;
    }

    function _getVoter(uint _idVoter) internal returns (Voter storage v) {
        if (_idVoter == 0) throw;
        if (_idVoter >= voters.length) throw;
        v = voters[_idVoter];
    }

    function nVoters() constant returns(uint) {
        return voters.length-1;
    }

    function getVoter(uint _idVoter) constant returns (
        string _name,
        address _owner,
        uint _balance
    ) {
        Voter voter = _getVoter(_idVoter);
        _name = voter.name;
        _owner = voter.owner;
        _balance = voter.balance;
    }


    function addDelegate(address _delegateAddr, string _name) onlyOwner returns(uint _idDelegate) {

        if (voterAddr2Idx[_delegateAddr] != 0) throw;
        if (delegateAddr2Idx[_delegateAddr] != 0) throw;

        uint idDelegate = delegates.length++;
        Delegate d = delegates[idDelegate];
        d.name = _name;
        d.owner = _delegateAddr;

        idDelegate += DELEGATE_OFFSET;

        delegateAddr2Idx[_delegateAddr] = idDelegate;
        payUser(_delegateAddr);

        DelegateAdded(idDelegate);
        return idDelegate;
    }

    function removeDelegate(uint _idDelegate) onlyOwner {

        Delegate d = _getDelegate(_idDelegate);
        if (d.deleted) throw;
        d.deleted = true;
        delegateAddr2Idx[d.owner] = 0;
    }

    function _getDelegate(uint _idDelegate) internal returns (Delegate storage d) {
        uint idDelegate = _idDelegate;
        if (idDelegate >= DELEGATE_OFFSET) idDelegate -= DELEGATE_OFFSET;
        if (idDelegate == 0) throw;
        if (idDelegate >= delegates.length) throw;
        d = delegates[idDelegate];
    }

    function nDelegates() constant returns(uint) {
        return delegates.length-1;
    }

    function getDelegate(uint _idDelegate) constant returns (
        string _name,
        address _owner,
        bool _deleted
    ) {
        Delegate delegate = _getDelegate(_idDelegate);
        _name = delegate.name;
        _owner = delegate.owner;
        _deleted = delegate.deleted;
    }

    function addCategory(string _name, uint _parentCategory) onlyOwner {
        Category c = categories[categories.length++];
        c.name = _name;
        if (_parentCategory > 0) {
            Category p = _getCategory(_parentCategory);
            c.delegateStatus = delegateStatusFactory.createDelegateStatus(p.delegateStatus);
        } else {
            c.delegateStatus = delegateStatusFactory.createDelegateStatus(0);
        }
        CategoryAdded(categories.length-1);
    }

    function removeCategory(uint _idCategory) onlyOwner {
        Category c = _getCategory(_idCategory);
        c.deleted = true;
    }

    function _getCategory(uint _idCategory) internal returns (Category storage c) {
        if (_idCategory == 0) throw;
        if (_idCategory >= categories.length) throw;
        c = categories[_idCategory];
    }

    function nCategories() constant returns (uint) {
        return categories.length-1;
    }

    function getCategory(uint _idCategory) constant returns (
        string _name,
        bool _deleted,
        address _delegateStatus
    ) {
        var category = _getCategory(_idCategory);
        _name = category.name;
        _deleted = category.deleted;
        _delegateStatus = address(category.delegateStatus);
    }


    function isDelegate(uint idUser) internal returns(bool) {
        return (idUser > DELEGATE_OFFSET);
    }

    function balanceOf(uint _idVoter) constant returns(uint) {
        return voters[_idVoter].balance;
    }


    function getVoteInfo(uint _idPoll, uint _idUser) constant returns(uint _time, uint _total, uint _nBallots, string _motivation) {
        Poll p = _getPoll(_idPoll);
        _time = p.votes[_idUser].time;
        _total = p.votes[_idUser].total;
        _nBallots = p.votes[_idUser].ballots.length;
        _motivation = p.votes[_idUser].motivation;
    }

    function getBallotInfo(uint _idPoll, uint _idUser, uint _idx) constant returns(bytes32 _ballot, uint _amount) {
        Poll p = _getPoll(_idPoll);
        _ballot = p.votes[_idUser].ballots[_idx];
        _amount = p.votes[_idUser].amounts[_idx];
    }


    function getPollDelegate(uint _idPoll, uint _idUser) constant returns (uint _idDelegate) {
        Poll p = _getPoll(_idPoll);
        return p.delegateStatus.getDelegate(_idUser);
    }

    function getCategoryDelegate(uint _idCategory, uint _idUser) constant returns (uint _idDelegate) {
        Category c = _getCategory(_idCategory);
        return c.delegateStatus.getDelegate(_idUser);
    }

    function payUser(address user) internal {
        if (user.balance < USER_ETH_LEVEL) {
            uint amount = USER_ETH_LEVEL - user.balance;
            if (amount <= this.balance) {
                if (!user.send(amount)) throw;
            }
        }
    }

    function () payable {

    }

// Events

    event VoterAdded(uint indexed idVoter);
    event PollAdded(uint indexed idPoll);
    event DelegateAdded(uint indexed idDelegate);
    event CategoryAdded(uint indexed idCategory);
}


contract DelegateStatusFactory {
    function createDelegateStatus(address _parentStatus) returns (DelegateStatus) {
        return new DelegateStatus(_parentStatus, msg.sender);
    }
}
