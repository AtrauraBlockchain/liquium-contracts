"use strict";

var async = require('async');
var _ = require('lodash');
var rlp = require('rlp');

var interfaces = require('./interfaces.js');

module.exports.deployOrganization = deployOrganization;
module.exports.deployDelegateStatusFactory = deployDelegateStatusFactory;
module.exports.getSingleChoiceParams = getSingleChoiceParams;
module.exports.addCategory = addCategory;
module.exports.addDelegate = addDelegate;
module.exports.deploySingleChoice = deploySingleChoice;

module.exports.getPolls = getPolls;
module.exports.getCategories = getCategories;
module.exports.getDelegates = getDelegates;
module.exports.getOrganizationInfo = getOrganizationInfo;
module.exports.getCategoriesDelegations = getCategoriesDelegations;
module.exports.getPollsStatus = getPollsStatus;
module.exports.getAllInfo = getAllInfo;

function deployOrganization (web3, account, opts, cb) {
    var organization;
    return async.series([
        function(cb) {
            if (!opts.delegateStatusFactory) {
                var contract = web3.eth.contract(interfaces.delegateStatusFactoryAbi);
                contract.new(
                    {
                        from: account,
                        data: interfaces.delegateStatusFactoryByteCode,
                        gas: '4000000'
                    },
                    function(err, _delegateStatusFactory) {
                        if (err) return cb(err);
                        if (typeof _delegateStatusFactory.address != 'undefined') {
                            opts.delegateStatusFactory = _delegateStatusFactory.address;
                            cb();
                        }
                    });
            } else {
                cb();
            }
        },
        function(cb) {
            var contract = web3.eth.contract(interfaces.organizationAbi);
            contract.new(
                opts.delegateStatusFactory,
                {
                    from: account,
                    data: interfaces.organizationByteCode,
                    gas: '4712000'
                },
                function(err, _organization) {
                    if (err) return cb(err);
                    if (typeof _organization.address != 'undefined') {
                        organization = _organization;
                        cb();
                    }
                });
        },
    ], function(err) {
        if (err) return cb(err);
        cb(null,organization);
    });
}

function deployDelegateStatusFactory(web3, account, opts, cb) {
    var delegateStatusFactory;
    return async.series([
        function(cb) {

            var contract = self.web3.eth.contract(interfaces.delegateStatusFactoryAbi);
            contract.new(
                {
                    from: account,
                    data: interfaces.delegateStatusFactoryByteCode,
                    gas: 3000000
                },
                function(err, _delegateStatusFactory) {
                    if (err) return cb(err);
                    if (typeof _delegateStatusFactory.address != 'undefined') {
                        delegateStatusFactory = _delegateStatusFactory;
                        cb();
                    }
                });
        },
    ], function(err) {
        if (err) return cb(err);
        cb(null,delegateStatusFactory);
    });
}

function addCategory(web3, organizationAddr, categoryName, idCateoryParent, cb) {
    var owner;
    var idCategory;
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);

    return async.series([
        function(cb) {
            organization.owner(function(err, res) {
                if (err) return cb(err);
                owner = res;
                cb();
            });
        },
        function(cb) {
            organization.addCategory(categoryName, idCateoryParent, { from: owner, gas: 1000000}, function(err, txHash) {
                if (err) return cb(err);

                    web3.eth.getTransactionReceipt(txHash, function(err, res) {
                        if (err) return cb(err);
                        // log 0 -> CategoryAdded
                        //      topic 0 -> Event Name
                        //      topic 1 -> idSubmission
                        idCategory = web3.toBigNumber(res.logs[0].topics[1]).toNumber();
                        cb();
                    });
            });
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, idCategory);
    });
}


function addDelegate(web3, organizationAddr, delegateName, delegateAccount, cb) {
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    organization.addDelegate(delegateName, { from: delegateAccount, gas: 1000000}, function(err, txHash) {
        if (err) return cb(err);

        web3.eth.getTransactionReceipt(txHash, function(err, res) {
            if (err) return cb(err);
            // log 0 -> CategoryAdded
            //      topic 0 -> Event Name
            //      topic 1 -> idSubmission
            var idDelegate = web3.toBigNumber(res.logs[0].topics[1]).toNumber();
            cb(null, idDelegate);
        });
    });
}

function deploySingleChoice(web3, organizationAddr, title, definition, cb) {
    var owner;
    var idPoll;
    var singleChoice;

    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);

    var d = [
        new Buffer(definition.question),
        _.map(definition.options, function(o) {
            return new Buffer(o);
        })
    ];

    var b= rlp.encode(d);
    var rlpDefinition =  '0x' + b.toString('hex');

    return async.series([
        function(cb) {
            organization.owner(function(err, res) {
                if (err) return cb(err);
                owner = res;
                cb();
            });
        },
        function(cb) {
            var contract = web3.eth.contract(interfaces.singleChoiceAbi);
            contract.new(
                organization.address,
                rlpDefinition,
                {
                    from: owner,
                    data: interfaces.singleChoiceByteCode,
                    gas: 3000000
                },
                function(err, _singleChoice) {
                    if (err) return cb(err);
                    if (typeof _singleChoice.address != 'undefined') {
                        singleChoice = _singleChoice;
                        cb();
                    }
                });
        },
        function(cb) {
            organization.addPoll(
                title,
                definition.closeDelegateTime,
                definition.closeTime,
                definition.idCategory,
                singleChoice.address,
                {
                    from: owner,
                    gas: 2000000
                },
                function(err, txHash) {
                    if (err) return cb(err);


                    web3.eth.getTransactionReceipt(txHash, function(err, res) {
                        // log 0 -> PollAdded
                        //      topic 0 -> Event Name
                        //      topic 1 -> idSubmission
                        idPoll = web3.toBigNumber(res.logs[0].topics[1]).toNumber();
                        cb();
                    });
                }
            );
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null,singleChoice, idPoll);
    });

}


function getOrganizationInfo(web3, organizationAddr, cb) {
    var orgJson = {};
    async.series([
        function(cb) {
            getCategories(web3, organizationAddr, function(err, res) {
                if (err) return cb(err);
                orgJson.categories = res;
                cb();
            });
        },
        function(cb) {
            getPolls(web3, organizationAddr, function(err, res) {
                if (err) return cb(err);
                orgJson.polls = res;
                cb();
            });
        },
        function(cb) {
            getDelegates(web3, organizationAddr, function(err, res) {
                if (err) return cb(err);
                orgJson.delegates = res;
                cb();
            });
        }
    ],function(err) {
        if (err) return cb(err);
        cb(null, orgJson);
    });
}

var extraParams = {
    "SINGLE_CHOICE": getSingleChoiceParams
};

function getPolls(web3,organizationAddr, cb) {

    var polls = {};
    var nPolls;
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);

    async.series([
        function(cb) {
            organization.nPolls(function(err,res) {
                if (err) return cb(err);
                nPolls = res.toNumber();
                cb();
            });
        },
        function(cb) {
            async.eachSeries(_.range(1,nPolls+1), function(idPoll, cb) {
                organization.polls(idPoll, function(err, res) {
                    if (err) return cb(err);
                    var pollType = web3.toAscii(res[0]);
                    pollType = pollType.replace(/\0/g, '');
                    var poll = {
                        idPoll: idPoll,
                        pollType: pollType,
                        title: res[1],
                        closeDelegateTime: res[2].toNumber(),
                        closeTime: res[3].toNumber(),
                        idCategory: res[4].toNumber(),
                        pollContractAddr: res[5],
                        delegateStatusAddr: res[6]
                    };
                    polls[idPoll] = poll;
                    if (extraParams[pollType]) {
                        extraParams[pollType](web3, res[5], function(err, ep) {
                            if (err) return cb(err);
                            _.extend(poll, ep);
                            cb();
                        });
                    } else {
                        cb();
                    }
                });
            }, cb);
        }

    ], function(err) {
        if (err) return cb(err);
        cb(null, polls);
    });
}

function getSingleChoiceParams(web3, singleChoiceAddr, cb) {
    var nOptions;
    var poll = {};
    var singleChoice = web3.eth.contract(interfaces.singleChoiceAbi).at(singleChoiceAddr);
    async.series([
        function(cb) {
            singleChoice.question(function(err, res) {
                if (err) return cb(err);
                poll.question = res;
                cb();
            });
        },
        function(cb) {
            singleChoice.nOptions(function(err, res) {
                if (err) return cb(err);
                nOptions = res.toNumber();
                cb();
            });
        },
        function(cb) {
            poll.options = [];
            async.eachSeries(_.range(nOptions), function(idOptions, cb) {
                var o={};
                async.series([
                    function(cb) {
                        singleChoice.options(idOptions, function(err, res) {
                            if (err) return cb(err);
                            o.answer = res;
                            cb();
                        });
                    },
                    function(cb) {
                        singleChoice.getBallot(idOptions, function(err, res) {
                            if (err) return cb(err);
                            o.ballot = res;
                            cb();
                        });
                    },
                    function(cb) {
                        singleChoice.result(idOptions, function(err, res) {
                            if (err) return cb(err);
                            o.result = web3.fromWei(res);
                            cb();
                        });
                    }
                ],function(err) {
                    if (err) return cb(err);
                    poll.options.push(o);
                    cb();
                });
            }, cb);
        }
    ],function(err){
        if (err) return cb(err);
        cb(null, poll);
    });
}

function getCategories(web3,organizationAddr, cb) {
    var categories = {};
    var nCategories;
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    async.series([
        function(cb) {
            organization.nCategories(function(err, res) {
                if (err) return cb(err);
                nCategories = web3.toBigNumber(res).toNumber();
                cb();
            });
        },
        function(cb) {
            async.eachSeries(_.range(1, nCategories+1), function(idCategory, cb) {
                organization.categories(idCategory, function(err, res) {
                    if (err) return cb(err);
                    categories[idCategory] = {
                        idCategory: idCategory,
                        name: res[0],
                        deleted: res[1],
                        delegateStatusAddr: res[2]
                    };
                    cb();
                });
            }, cb);
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, categories);
    });
}

function getDelegates(web3, organizationAddr, cb) {
    var delegates = {};
    var nDelegates;
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    async.series([
        function(cb) {
            organization.nDelegates(function(err, res) {
                if (err) return cb(err);
                nDelegates = web3.toBigNumber(res).toNumber();
                cb();
            });
        },
        function(cb) {
            async.eachSeries(_.range(1, nDelegates+1), function(idDelegate, cb) {
                organization.delegates(idDelegate, function(err, res) {
                    if (err) return cb(err);
                    delegates[idDelegate] = {
                        idDelegate: idDelegate,
                        name: res[0],
                        owner: res[1],
                        deleted: res[2]
                    };
                    cb();
                });
            }, cb);
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, delegates);
    });
}

function getCategoriesDelegations(web3,organizationAddr, voter, cb) {
    var voterCategories = {};
    var categories;
    async.series([
        function(cb) {
            getOrganizationInfo(web3, organizationAddr, function(err, _organizationInfo) {
                if (err) return cb(err);
                categories = _.values(_organizationInfo.categories);
                cb();
            });
        },
        function(cb) {
            async.eachSeries(categories, function(category, cb) {
                if (category.deleted) return cb();
                getDelegations(web3, category.delegateStatusAddr, voter, function(err, _delegationList) {
                    if (err) return cb(err);
                    voterCategories[category.idCategory] = _delegationList;
                    cb();
                });
            }, cb);
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, voterCategories);
    });
}

function getPollsStatus(web3,organizationAddr, _voter, cb) {
    var voter = toAddress(web3, _voter);
    var voterPolls = {};
    var polls;
    async.series([
        function(cb) {
            getOrganizationInfo(web3, organizationAddr, function(err, _organizationInfo) {
                if (err) return cb(err);
                polls = _.values(_organizationInfo.polls);
                cb();
            });
        },
        function(cb) {
            async.eachSeries(polls, function(poll, cb) {
                var pollStatus = {
                    idPoll: poll.idPoll
                };
                async.series([
                    function(cb) {
                        getDelegations(web3, poll.delegateStatusAddr, voter, function(err, _delegationList) {
                            if (err) return cb(err);
                            pollStatus.delegationList = _delegationList;
                            cb();
                        });
                    },
                    function(cb) {
                        var finalVoter;
                        if (pollStatus.delegationList.length === 0) {
                            finalVoter = voter;
                        } else {
                            finalVoter = pollStatus.delegationList[pollStatus.delegationList.length-1];
                        }
                        getVote(web3, organizationAddr, poll.idPoll, finalVoter, function(err, _vote) {
                            if (err) return cb(err);
                            pollStatus.vote = _vote;
                            cb();
                        });
                    },
                    function(cb) {
                        getVotingPower(web3, poll.delegateStatusAddr, voter, function(err, _votingPower) {
                            if (err) return cb(err);
                            pollStatus.votingPower = _votingPower;
                            cb();
                        });
                    }
                ], function(err) {
                    if (err) return cb(err);
                    voterPolls[poll.idPoll] = pollStatus;
                    cb();
                });

            }, cb);
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, voterPolls);
    });
}

function getDelegations(web3, delegateStatusAddr, _voter, cb) {
    var voter = toAddress(web3, _voter);
    var delegateStatus = web3.eth.contract(interfaces.delegateStatusAbi).at(delegateStatusAddr);
    var delegationList = [];
    var done = false;
    var it = voter;
    async.whilst(
        function() {
            return !done;
        },
        function(cb) {
            delegateStatus.getDelegate(it, function(err, res) {
                if (err) return cb(err);
                var idDelegate = web3.toBigNumber(res).toNumber();
                if (idDelegate) {
                    delegationList.push(idDelegate);
                } else {
                    done = true;
                }
                it = res;
                cb();
            });
        },
        function(err) {
            if (err) return cb(err);
            cb(null, delegationList);
        }
    );
}

function toAddress(web3, a) {
    if (web3.isAddress(a)) return a;
    try {
        var S = web3.toBigNumber(a).toString(16);
        while (S.length < 40) S = "0" + S;
        S="0x" +S;
        return S;
    } catch (err) {
        return "0x0";
    }
}

function isDelegate(web3, voter) {
    var voterBN = web3.toBigNumber(voter);
    var limitBN = web3.toBigNumber("0x1000000");
    return voterBN.cmp(limitBN)<0;
}

function getVote(web3, organizationAddr, idPoll, voter, cb) {
    if (isDelegate(web3, voter)) {
        getDelegateVote(web3, organizationAddr, idPoll, voter, cb);
    } else {
        getVoterVote(web3, organizationAddr, idPoll, voter, cb);
    }
}

function getVoterVote(web3, organizationAddr, idPoll, _voter, cb) {
    var vote = {};
    var voter = toAddress(web3, _voter);
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    var nBallots;

    async.series([
        function(cb) {
            organization.getVoteInfo(idPoll,  voter, function(err, res) {
                if (err) return cb(err);
                vote.time = res[0].toNumber();
                vote.total = res[1].toNumber();
                vote.ballots = [];
                nBallots = res[2];
                cb();
            });
        },
        function(cb) {
            var i =0;
            var totalAmount = web3.toBigNumber(0);
            async.whilst(
                function() {
                    return i<nBallots;
                },
                function(cb) {
                    organization.getBallotInfo(idPoll, voter, i, function(err, res) {
                        if (err) return cb(err);
                        if (!res[1].isZero()) {
                            vote.ballots.push({
                                ballot: res[0],
                                amount: res[1]
                            });
                            totalAmount = totalAmount.add(res[1]);
                        }
                        i+=1;
                        cb();
                    });

                },
                function(err) {
                    if (err) return cb(err);
                    _.each(vote.ballots, function(ballot) {
                        ballot.amount = ballot.amount.
                                        mul(100).
                                        div(totalAmount).
                                        toNumber();
                    });
                    cb();
                }
            );
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, vote);
    });

}

function getDelegateVote(web3, organizationAddr, idPoll, _voter, cb) {
    var vote = {};
    var voter = web3.toBigNumber(_voter).toNumber();
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    var nBallots;

    async.series([
        function(cb) {
            organization.dGetVoteInfo(idPoll,  voter, function(err, res) {
                if (err) return cb(err);
                voter.time = res[0].toNumber();
                voter.total = res[1].toNumber();
                voter.ballots = [];
                nBallots = res[2];
                voter.motivation = res[3];
                cb();
            });
        },
        function(cb) {
            var i =0;
            var totalAmount = web3.toBigNumber(0);
            async.whilest(
                function() {
                    return i<nBallots;
                },
                function(cb) {
                    organization.dGetBallotInfo(idPoll, voter, i, function(err, res) {
                        if (err) return cb(err);
                        if (!res[1].isZero()) {
                            vote.ballots.push({
                                ballot: res[0],
                                amount: res[1]
                            });
                            totalAmount = totalAmount.add(res[1]);
                        }
                        i+=1;
                        cb();
                    });

                },
                function(err) {
                    if (err) return cb(err);
                    _.each(vote.ballots, function(ballot) {
                        ballot.amount = ballot.amount.
                                        mul(100).
                                        div(totalAmount).
                                        toNumber();
                    });
                    cb();
                }
            );
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, vote);
    });
}

function getVotingPower(web3, delegateStatusAddr,  _voter, cb) {
    var voter = toAddress(web3, _voter);
    var delegateStatus = web3.eth.contract(interfaces.delegateStatusAbi).at(delegateStatusAddr);
    delegateStatus.getVotingPower(voter, function(err, res) {
        if (err) return cb(err);
        cb(null, web3.fromWei(res));
    });
}

function getAllInfo(web3, organizationAddr, voter, cb) {
    var organizationInfo;
    async.series([
        function(cb) {
            getOrganizationInfo(web3, organizationAddr, function(err, res) {
                if (err) return cb(err);
                organizationInfo = _.clone(res);
                cb();
            });
        },
        function(cb) {
            getCategoriesDelegations(web3, organizationAddr, voter, function(err, res) {
                if (err) return cb(err);
                _.each(res, function(delegationList, idCategory) {
                    organizationInfo.categories[idCategory].delegationList = delegationList;
                });
                cb();
            });
        },
        function(cb) {
            getPollsStatus(web3, organizationAddr ,voter, function(err, res) {
                if (err) return cb(err);
                _.each(res, function(pollStatus, idPoll) {
                    _.extend(organizationInfo.polls[idPoll],pollStatus);
                });
                cb();
            });
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, organizationInfo);
    });
}
