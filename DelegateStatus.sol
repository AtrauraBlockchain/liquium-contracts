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
    function balanceOf(address a) constant returns(uint);
}

contract DelegateStatus is Owned {

    /// @dev `Checkpoint` is the structure that attaches a block number to the a
    ///  given value
    struct  Checkpoint {

        // `fromBlock` is the block number that the value was generated from
        uint128 fromBlock;

        // `value` is the amount of tokens at a specific block number
        uint128 value;
    }

    mapping (address => Checkpoint[]) votingPower;
    mapping (address => Checkpoint[]) delegate;

    uint creationBlock;
    DelegateStatus parent;

    function DelegateStatus(address _parentDelegateStatus, address _owner) {
        owner = _owner;
        parent = DelegateStatus(_parentDelegateStatus);
        creationBlock = block.number;
    }

    function getVotingPower(address _voter) constant returns(uint) {
        return getVotingPowerAt(_voter, block.number);
    }

    function getVotingPowerAt(address _voter, uint _block) constant returns(uint) {
        if (isDelegate(_voter)) {

            if (    (votingPower[_voter].length == 0)
                 || (votingPower[_voter][0].fromBlock > _block))
            {
                if ((address(parent) != 0)&&(_block>=creationBlock)) {
                    return parent.getVotingPowerAt(_voter, creationBlock);
                } else {
                    return 0;
                }
            }
            return getValueAt(votingPower[_voter], _block);
        } else {
            return Token(owner).balanceOf(_voter);
        }
    }


    function setDelegate(address _voter, address _delegate) {

        if (getDelegate(_voter) == _delegate) return;

        undelegate(_voter);

        if (_delegate == 0) return;

        uint amount = getVotingPower(_voter);

        address it = _delegate;
        address finalDelegate;
        while (it != 0) {
            finalDelegate = it;
            if (it == _voter) throw; // Do not allow cyclic delegations
            updateValueAtNow(votingPower[finalDelegate], getVotingPower(finalDelegate) + amount);
            it = getDelegate(it);
        }

        if (finalDelegate == 0) return;

        updateValueAtNow(delegate[_voter], uint(_delegate));
    }

    function getDelegate(address _voter) constant returns (address _delegate) {
        return getDelegateAt(_voter, block.number);
    }

    function getDelegateAt(address _voter, uint _block) constant returns (address _delegate) {
        if (    (delegate[_voter].length == 0)
             || (delegate[_voter][0].fromBlock > _block))
        {
            if ((address(parent) != 0)&&(_block>=creationBlock)) {
                return parent.getDelegateAt(_voter, creationBlock);
            } else {
                return 0;
            }
        }
        return address(getValueAt(delegate[_voter], _block));
    }

    function getFinalDelegate(address _voter) constant returns (address _finalDelegate) {
        address it = getDelegate(_voter);
        while (it != 0) {
            _finalDelegate = it;
            it = getDelegate(it);
        }
    }

    function undelegate(address _voter) {

        uint amount = getVotingPower(_voter);

        address finalDelegate;
        address it = getDelegate(_voter);
        while (it != 0) {
            finalDelegate = it;
            updateValueAtNow(votingPower[finalDelegate], getVotingPower(finalDelegate) - amount);
            it = getDelegate(it);
        }

        if (finalDelegate == 0) return;

        updateValueAtNow(delegate[_voter], 0);

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

    function isDelegate(address _voter) internal returns(bool) {
        return (uint(_voter) < 0x1000000);
    }
}
