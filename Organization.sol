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

      function addVoter(address _voter, uint _amount);
      function removeVoter(address _voter, uint _amount);
      function addPoll(
        string _title,
        uint _closeDelegateTime,
        uint _closeTime,
        uint _categoryId,
        address _pollContractAddr) returns (uint _idPoll);


// Interface for Final Voters
      function vote(uint _idPoll, bytes32[] _ballots, uint[] _amounts);
      function unvote(uint _idPoll);
      function setDelegateSinglePoll(uint _idPoll, uint _delegate);
      function setDelegates(uint[] _categoryIds, uint[] _delegates);

/// Interface for delegates

      function addDelegate(string name) returns(uint _idDelegate);
      function removeDelegate(uint _idDelegate);

      function dVote(uint _idDelegate, uint _idPoll, bytes32[] _ballots, uint[] _amounts, string motivation);
      function dUnvote(uint _idDelegate, uint _idPoll);
      function dSetDelegateSinglePoll(uint _idDelegate, uint _idPoll, uint _delegate);
      function dSetDelegates(uint _idDelegate, uint[] _categoryIds, uint[] _delegates);

// Query for votes
    function getVoteInfo(uint _idPoll, address _voter) constant returns(uint _time, uint _total, uint _nBallots);
    function getBallotInfo(uint _idPoll, address _voter, uint _idx) constant returns(bytes32 _ballot, uint _amount);
    function dGetVoteInfo(uint _idPoll, uint _idDelegate) constant returns(uint _time, uint _total, uint _nBallots, string _motivation);
    function dGetBallotInfo(uint _idPoll, uint _idDelegate, uint _idx) constant returns(bytes32 _ballot, uint _amount);

// Query delegate
    function getPollDelegate(uint _idPoll, address _voter) constant returns (uint _idDelegate);
    function getCategoryDelegate(uint _idCategory, address _voter) constant returns (uint _idDelegate);
    function dGetPollDelegaet(uint _idPoll, uint _idDelegate) constant returns (uint _idDelegateDelegate);
    function dGetCategoryDelegate(uint _idCategory, uint _idDelegate) constant returns (uint _idDelegateDelegate);
}


contract Organization is OrganizationInterface, Owned {

    uint constant  MIN_TIME_FINAL_VOTING = 86400;
    uint constant  DELEGATE_MODIFICATION_TIME = 3600*4;


    struct Category {
        string name;
        bool deleted;
        DelegateStatus delegateStatus;
        uint[] activePolls;
    }

    Category[] public categories;

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

        mapping(address => Vote) votes;
    }

    Poll[] allPolls;

    struct Delegate {
        string name;
        address owner;
        bool deleted;
    }

    Delegate[] public delegates;

    mapping(address => uint) balances;
    uint public totalSupply;

    DelegateStatusFactory delegateStatusFactory;

    function Organization(address _delegateStatusFactory) {
        delegateStatusFactory = DelegateStatusFactory(_delegateStatusFactory);
        categories.length = 1;
        delegates.length =1;
        allPolls.length = 1;
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

        uint idPoll = allPolls.length++;
        Poll p = allPolls[idPoll];
        p.title = _title;
        p.closeDelegateTime = _closeDelegateTime;
        p.closeTime = _closeTime;
        p.idCategory = _categoryId;
        p.pollContract = PollContractInterface(_pollContractAddr);
        p.delegateStatus = delegateStatusFactory.createDelegateStatus(c.delegateStatus);

        c.activePolls.push(idPoll);

        PollAdded(idPoll);
    }


    function vote(uint _idPoll, bytes32[] _ballots, uint[] _amounts) {
        var p = getPoll(_idPoll);

        if (!doVote(p, msg.sender, _ballots, _amounts, "")) throw;
    }

    function dVote(uint _idDelegate, uint _idPoll, bytes32[] _ballots, uint[] _amounts, string _motivation) {
        Delegate d = getDelegate(_idDelegate);
        if (d.owner != msg.sender) throw;

        address voter = address(_idDelegate);

        var p = getPoll(_idPoll);

        if (!doVote(p, address(_idDelegate), _ballots, _amounts, _motivation)) throw;
    }

    int public test1;
    bytes32 public test2;

    function doVote(Poll storage _poll, address _voter, bytes32[] _ballots, uint[] _amounts, string _motivation) internal returns (bool _succes) {

        if (!canVote(_poll, _voter)) return false;

        var amount = _poll.delegateStatus.getVotingPower(_voter);

        address delegate = _poll.delegateStatus.getDelegate(_voter);

        if (delegate != 0) {
            var finalDelegate = _poll.delegateStatus.getFinalDelegate(_voter);

            if ((finalDelegate != 0) && (hasVoted(_poll,finalDelegate))) {
                deltaVote(_poll, finalDelegate, -int(amount));
            }

            _poll.delegateStatus.undelegate(_voter);
        }

        setVote(_poll, _voter, _ballots, _amounts, amount, _motivation);
        return true;
    }

    function unvote(uint _idPoll) {
        var p = getPoll(_idPoll);

        if (!doUnvote(p, msg.sender)) throw;
    }

    // Will allways throw.
    function dUnvote(uint _idDelegate, uint _idPoll) {
        Delegate d = getDelegate(_idDelegate);
        if (d.owner != msg.sender) throw;

        address voter = address(_idDelegate);

        var p = getPoll(_idPoll);

        if (!doUnvote(p, voter)) throw;
    }

    function doUnvote(Poll storage _poll, address _voter) internal returns (bool _success)  {
        if (!canVote(_poll, _voter)) return false;

        uint amount = _poll.delegateStatus.getVotingPower(_voter);

        if (hasVoted(_poll, _voter)) {
            setVote(_poll, _voter, new bytes32[](0), new uint[](0), 0, "");
        }

        Category c = categories[_poll.idCategory];

        var delegate = c.delegateStatus.getDelegate(_voter);

        if (delegate != 0) {
            _poll.delegateStatus.setDelegate(_voter, delegate);
            address finalDelegate = _poll.delegateStatus.getFinalDelegate(_voter);
            if ((finalDelegate != 0)&&( hasVoted(_poll,finalDelegate))) {
                deltaVote(_poll, finalDelegate, int(amount));
            }
        }

        return true;
    }

    function setDelegateSinglePoll(uint _idPoll, uint _delegate) {
        Poll p = getPoll(_idPoll);

        if (!doSetDelegateSinglePoll(p, msg.sender, _delegate)) throw;
    }

    function dSetDelegateSinglePoll(uint _idDelegate, uint _idPoll, uint _delegate) {
        Delegate d = getDelegate(_idDelegate);
        if (d.owner != msg.sender) throw;

        Poll p = getPoll(_idPoll);

        address voter = address(_idDelegate);

        if (!doSetDelegateSinglePoll(p, voter, _delegate)) throw;
    }

    function doSetDelegateSinglePoll(Poll storage _poll, address _voter, uint _delegate) internal returns(bool _succes) {

        if (_delegate >= delegates.length) return false;
        if (! canVote(_poll, _voter) ) return false;

        int amount = int(_poll.delegateStatus.getVotingPower(_voter));

        if (hasVoted(_poll, _voter)) {
            setVote(_poll, _voter, new bytes32[](0), new uint[](0), 0, "");
        }

        _poll.delegateStatus.setDelegate(_voter, address(_delegate));

        var finalDelegate = _poll.delegateStatus.getFinalDelegate(_voter);

        if ((finalDelegate != 0) && (_poll.votes[finalDelegate].time != 0)) {
            deltaVote(_poll, finalDelegate, amount);
        }

        return true;
    }

    function setDelegates(uint[] _categoryIds, uint[] _delegates) {
        if (!doSetDelegates(msg.sender, _categoryIds, _delegates)) throw;
    }

    function dSetDelegates(uint _idDelegate, uint[] _categoryIds, uint[] _delegates) {
        Delegate d = getDelegate(_idDelegate);
        if (d.owner != msg.sender) throw;

        address voter = address(_idDelegate);

        if (!doSetDelegates(voter, _categoryIds, _delegates)) throw;

    }

    function doSetDelegates(address _voter, uint[] _categoryIds, uint[] _delegates) returns (bool _success) {
        uint i;
        uint j;
        if (_categoryIds.length != _delegates.length) return false;
        for (i=0; i<_categoryIds.length; i++) {
            Category c = getCategory(_categoryIds[i]);
            uint delegate = _delegates[i];
            if (!isDelegate(address(delegate))) return false;
            c.delegateStatus.setDelegate(_voter,address(delegate));
            for (j=0; j<c.activePolls.length; j++) {
                Poll p = allPolls[c.activePolls[j]];
                if (now < p.closeTime ) {
                    if (!hasVoted(p, _voter)) {
                        doSetDelegateSinglePoll(p, _voter, delegate);
                    }
                } else {
                    c.activePolls[j] = c.activePolls[c.activePolls.length-1];
                    c.activePolls.length --;
                    j--;
                }
            }
        }
        return true;
    }


    function canVote(Poll storage _poll, address _voter) internal returns (bool) {
        if (now >= _poll.closeTime) return false;
        if (isDelegate(_voter)) {
            if (_poll.votes[_voter].time != 0) return false;
            if (now >= _poll.closeDelegateTime) {
                address finalDelegate = _poll.delegateStatus.getFinalDelegate(_voter);
                if (finalDelegate == 0) return false;
                if (_poll.votes[finalDelegate].time == 0 ) return false;
                if (now > _poll.votes[finalDelegate].time + DELEGATE_MODIFICATION_TIME) return false;
            }
        } else {
            if (_poll.delegateStatus.getVotingPower(_voter) == 0) return false;
        }

        return true;
    }

    function hasVoted(Poll storage _poll, address _voter) internal returns (bool) {
        return _poll.votes[_voter].time > 0;
    }





    function setVote(Poll storage p, address _voter, bytes32[] _ballots, uint[] _amounts, uint _amount, string _motivation) internal {
        uint i;
        int a;
        uint total;

        Vote v = p.votes[_voter];

        total = 0;
        for (i=0; i<v.ballots.length; i++) {
            total += v.amounts[i];
        }

        for (i=0; i< v.ballots.length; i++) {
            a = int(v.total * v.amounts[i] / total);
            p.pollContract.deltaVote(-a, v.ballots[i]);
            v.amounts[i] =0;
            v.ballots[i] =0;
        }

        v.ballots.length=0;
        v.amounts.length=0;
        v.total = 0;
        v.time = 0;
        v.motivation = "";

        total = 0;
        for (i=0; i<_ballots.length; i++) {
            total += _amounts[i];
        }

        if (total == 0) return;
        v.time = now;
        v.motivation = _motivation;
        for (i=0; i< _ballots.length; i++) {
            v.ballots.push(_ballots[i]);
            v.amounts.push(_amounts[i]);
            a = int(_amounts[i] * _amount / total);
            p.pollContract.deltaVote(a, _ballots[i]);
        }
        v.total = _amount;
    }

    function deltaVote(Poll storage p, address _voter, int _amount) internal {
        uint i;
        Vote v = p.votes[_voter];
        uint total = 0;
        if (_amount == 0) return;
        for (i=0; i<v.ballots.length; i++) {
            total += v.amounts[i];
        }
        if (total == 0) return;
        for (i=0; i< v.ballots.length; i++) {
            int a = int(v.amounts[i]) * _amount / int(total);
            p.pollContract.deltaVote(a, v.ballots[i]);
        }
        v.total += uint(_amount);
    }

    function getPoll(uint _idPoll) internal returns (Poll storage p) {
        if (_idPoll == 0) throw;
        if (_idPoll >= allPolls.length) throw;
        p = allPolls[_idPoll];
    }

    function nPolls() constant returns(uint) {
        return allPolls.length-1;
    }

    function polls(uint _idPoll) constant returns(
        bytes32 _pollType,
        string _title,
        uint _closeDelegateTime,
        uint _closeTime,
        uint _idCategory,
        address _pollContractAddr,
        address _delegateStatusAddr
    ) {
        Poll p = getPoll(_idPoll);
        _title = p.title;
        _closeDelegateTime = p.closeDelegateTime;
        _closeTime = p.closeTime;
        _idCategory = p.idCategory;
        _pollContractAddr = address(p.pollContract);
        _delegateStatusAddr = address(p.delegateStatus);
        _pollType = p.pollContract.pollType();
    }

    function getCategory(uint _idCategory) internal returns (Category storage c) {
        if (_idCategory == 0) throw;
        if (_idCategory >= categories.length) throw;
        c = categories[_idCategory];
    }

    function getDelegate(uint _idDelegate) internal returns (Delegate storage d) {
        if (_idDelegate == 0) throw;
        if (_idDelegate >= delegates.length) throw;
        d = delegates[_idDelegate];
    }

    function nDelegates() constant returns(uint) {
        return delegates.length-1;
    }

    function addVoter(address _voter, uint _amount) onlyOwner {
        uint i;
        uint j;
        address delegate;
        Poll p;

        balances[_voter] += _amount;
        totalSupply += _amount;
        for (i=1; i<categories.length; i++) {
            var c = categories[i];
            delegate = c.delegateStatus.getDelegate(_voter);
            if (delegate!=0) {
                p.delegateStatus.setDelegate(_voter, delegate);
            }

            for (j=0; j<c.activePolls.length; j++) {
                p = allPolls[c.activePolls[j]];
                if (now < p.closeTime ) {
                    if (p.votes[_voter].time != 0) {
                        deltaVote(p, _voter, int(_amount));
                    } else {
                        delegate = p.delegateStatus.getDelegate(_voter);
                        if (delegate!=0) {
                            p.delegateStatus.setDelegate(_voter, delegate);
                        }
                    }
                } else {
                    c.activePolls[j] = c.activePolls[c.activePolls.length-1];
                    c.activePolls.length --;
                    j--;
                }
            }
        }
    }

    function removeVoter(address _voter, uint _amount) onlyOwner {
        uint i;
        uint j;
        address delegate;

        if (_amount > balances[_voter]) throw;
        balances[_voter] -= _amount;
        totalSupply -= _amount;
        for (i=1; i<categories.length; i++) {
            var c = categories[i];
            delegate = c.delegateStatus.getDelegate(_voter);
            if (delegate!=0) {
                p.delegateStatus.setDelegate(_voter, delegate);
            }
            for (j=0; j<c.activePolls.length; j++) {
                Poll p = allPolls[c.activePolls[j]];
                if (now < p.closeTime ) {
                    if (p.votes[_voter].time != 0) {
                        deltaVote(p, _voter, -int(_amount));
                    } else {
                        delegate = p.delegateStatus.getDelegate(_voter);
                        if (delegate!=0) {
                            p.delegateStatus.setDelegate(_voter, delegate);
                        }
                    }
                } else {
                    c.activePolls[j] = c.activePolls[c.activePolls.length-1];
                    c.activePolls.length --;
                    j--;
                }
            }
        }
    }

    function addDelegate(string _name) returns(uint _idDelegate) {
        uint idDelegate = delegates.length++;
        Delegate d = delegates[idDelegate];
        d.name = _name;
        d.owner = msg.sender;
        DelegateAdded(idDelegate);
        return idDelegate;
    }

    function removeDelegate(uint _idDelegate) {
        Delegate d = getDelegate(_idDelegate);
        if (d.owner != msg.sender) throw;
        d.deleted = true;
    }

    function addCategory(string _name, uint _parentCategory) onlyOwner {
        Category c = categories[categories.length++];
        c.name = _name;
        if (_parentCategory > 0) {
            Category p = getCategory(_parentCategory);
            c.delegateStatus = delegateStatusFactory.createDelegateStatus(p.delegateStatus);
        } else {
            c.delegateStatus = delegateStatusFactory.createDelegateStatus(0);
        }
        CategoryAdded(categories.length-1);
    }

    function removeCategory(uint _idCategory) onlyOwner {
        Category c = getCategory(_idCategory);
        c.deleted = true;
    }

    function nCategories() constant returns (uint) {
        return categories.length-1;
    }

    function isDelegate(address _voter) internal returns(bool) {
        return (uint(_voter) < 0x1000000);
    }

    function balanceOf(address _voter) constant returns(uint) {
        return balances[_voter];
    }


    function getVoteInfo(uint _idPoll, address _voter) constant returns(uint _time, uint _total, uint _nBallots) {
        Poll p = getPoll(_idPoll);
        _time = p.votes[_voter].time;
        _total = p.votes[_voter].total;
        _nBallots = p.votes[_voter].ballots.length;
    }

    function getBallotInfo(uint _idPoll, address _voter, uint _idx) constant returns(bytes32 _ballot, uint _amount) {
        Poll p = getPoll(_idPoll);
        _ballot = p.votes[_voter].ballots[_idx];
        _amount = p.votes[_voter].amounts[_idx];
    }

    function dGetVoteInfo(uint _idPoll, uint _idDelegate) constant returns(uint _time, uint _total, uint _nBallots, string _motivation) {
        Delegate d = getDelegate(_idDelegate);
        address voter = address(_idDelegate);

        Poll p = getPoll(_idPoll);
        _time = p.votes[voter].time;
        _total = p.votes[voter].total;
        _nBallots = p.votes[voter].ballots.length;
        _motivation = p.votes[voter].motivation;
    }

    function dGetBallotInfo(uint _idPoll, uint _idDelegate, uint _idx) constant returns(bytes32 _ballot, uint _amount) {
        Delegate d = getDelegate(_idDelegate);
        address voter = address(_idDelegate);

        Poll p = getPoll(_idPoll);
        _ballot = p.votes[voter].ballots[_idx];
        _amount = p.votes[voter].amounts[_idx];
    }


    function getPollDelegate(uint _idPoll, address _voter) constant returns (uint _idDelegate) {
        Poll p = getPoll(_idPoll);
        return uint(p.delegateStatus.getDelegate(_voter));
    }

    function getCategoryDelegate(uint _idCategory, address _voter) constant returns (uint _idDelegate) {
        Category c = getCategory(_idCategory);
        return uint(c.delegateStatus.getDelegate(_voter));
    }

    function dGetPollDelegaet(uint _idPoll, uint _idDelegate) constant returns (uint _idDelegateDelegate) {
        Delegate d = getDelegate(_idDelegate);
        address voter = address(_idDelegate);

        Poll p = getPoll(_idPoll);
        return uint(p.delegateStatus.getDelegate(voter));
    }

    function dGetCategoryDelegate(uint _idCategory, uint _idDelegate) constant returns (uint _idDelegateDelegate) {
        Delegate d = getDelegate(_idDelegate);
        address voter = address(_idDelegate);

        Category c = getCategory(_idCategory);
        return uint(c.delegateStatus.getDelegate(voter));
    }


// Events

    event PollAdded(uint indexed idPoll);
    event DelegateAdded(uint indexed idDelegate);
    event CategoryAdded(uint indexed idCategory);
}


contract DelegateStatusFactory {
    function createDelegateStatus(address _parentStatus) returns (DelegateStatus) {
        return new DelegateStatus(_parentStatus, msg.sender);
    }
}
