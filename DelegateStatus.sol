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

contract Token {
    function balanceOf(uint idVoter) constant returns(uint);
}

contract DelegateStatus is Owned {

    uint constant  DELEGATE_OFFSET = 0x100000000;

    /// @dev `Checkpoint` is the structure that attaches a block number to the a
    ///  given value
    struct  Checkpoint {

        // `fromBlock` is the block number that the value was generated from
        uint128 fromBlock;

        // `value` is the amount of tokens at a specific block number
        uint128 value;
    }

    mapping (uint => Checkpoint[]) votingPower;
    mapping (uint => Checkpoint[]) delegate;

    uint creationBlock;
    DelegateStatus parent;

    function DelegateStatus(address _parentDelegateStatus, address _owner) {
        owner = _owner;
        parent = DelegateStatus(_parentDelegateStatus);
        creationBlock = block.number;
    }

    function getVotingPower(uint _idUser) constant returns(uint) {
        return getVotingPowerAt(_idUser, block.number);
    }

    function getVotingPowerAt(uint  _idUser, uint _block) constant returns(uint) {
        if (isDelegate(_idUser)) {

            if (    (votingPower[_idUser].length == 0)
                 || (votingPower[_idUser][0].fromBlock > _block))
            {
                if ((address(parent) != 0)&&(_block>=creationBlock)) {
                    return parent.getVotingPowerAt(_idUser, creationBlock);
                } else {
                    return 0;
                }
            }
            return getValueAt(votingPower[_idUser], _block);
        } else {
            return Token(owner).balanceOf(_idUser);
        }
    }


    function setDelegate(uint _idUser, uint _idDelegate) {

        if (getDelegate(_idUser) == _idDelegate) return;

        undelegate(_idUser);

        if (_idDelegate == 0) return;

        uint amount = getVotingPower(_idUser);

        uint it = _idDelegate;
        uint finalDelegate;
        while (it != 0) {
            finalDelegate = it;
            if (it == _idUser) throw; // Do not allow cyclic delegations
            updateValueAtNow(votingPower[finalDelegate], getVotingPower(finalDelegate) + amount);
            it = getDelegate(it);
        }

        if (finalDelegate == 0) return;

        updateValueAtNow(delegate[_idUser], uint(_idDelegate));
    }

    function getDelegate(uint _idUser) constant returns (uint _idDelegate) {
        return getDelegateAt(_idUser, block.number);
    }

    function getDelegateAt(uint _idUser, uint _block) constant returns (uint _idDelegate) {
        if (    (delegate[_idUser].length == 0)
             || (delegate[_idUser][0].fromBlock > _block))
        {
            if ((address(parent) != 0)&&(_block>=creationBlock)) {
                return parent.getDelegateAt(_idUser, creationBlock);
            } else {
                return 0;
            }
        }
        return getValueAt(delegate[_idUser], _block);
    }

    function getFinalDelegate(uint _idUser) constant returns (uint _finalDelegate) {
        uint it = getDelegate(_idUser);
        while (it != 0) {
            _finalDelegate = it;
            it = getDelegate(it);
        }
    }

    function undelegate(uint _idUser) {

        uint amount = getVotingPower(_idUser);

        uint finalDelegate;
        uint it = getDelegate(_idUser);
        while (it != 0) {
            finalDelegate = it;
            updateValueAtNow(votingPower[finalDelegate], getVotingPower(finalDelegate) - amount);
            it = getDelegate(it);
        }

        if (finalDelegate == 0) return;

        updateValueAtNow(delegate[_idUser], 0);

    }

////////////////
// Internal helper functions to query and set a value in a snapshot array
////////////////

    function getValueAt(Checkpoint[] storage checkpoints, uint _block
    ) constant internal returns (uint) {
        if (checkpoints.length == 0) return 0;
        // Shortcut for the actual value
        if (_block >= checkpoints[checkpoints.length-1].fromBlock)
            return checkpoints[checkpoints.length-1].value;
        if (_block < checkpoints[0].fromBlock) return 0;

        // Binary search of the value in the array
        uint min = 0;
        uint max = checkpoints.length-1;
        while (max > min) {
            uint mid = (max + min + 1)/ 2;
            if (checkpoints[mid].fromBlock<=_block) {
                min = mid;
            } else {
                max = mid-1;
            }
        }
        return checkpoints[min].value;
    }

    function updateValueAtNow(Checkpoint[] storage checkpoints, uint _value
    ) internal  {
        if ((checkpoints.length == 0)
        || (checkpoints[checkpoints.length -1].fromBlock < block.number)) {
               Checkpoint newCheckPoint = checkpoints[ checkpoints.length++ ];
               newCheckPoint.fromBlock =  uint128(block.number);
               newCheckPoint.value = uint128(_value);
           } else {
               Checkpoint oldCheckPoint = checkpoints[checkpoints.length-1];
               oldCheckPoint.value = uint128(_value);
           }
    }


    function isDelegate(uint idUser) internal returns(bool) {
        return (idUser > DELEGATE_OFFSET);
    }
}
