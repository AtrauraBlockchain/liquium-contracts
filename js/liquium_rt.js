"use strict";

var async = require('async');
var _ = require('lodash');
var rlp = require('rlp');

var interfaces = require('./interfaces.js');

module.exports.deployOrganization = deployOrganization;
module.exports.deployDelegateStatusFactory = deployDelegateStatusFactory;
module.exports.getSingleChoiceParams = getSingleChoiceParams;
module.exports.addCategory = addCategory;
module.exports.removeCategory = removeCategory;
module.exports.addDelegate = addDelegate;
module.exports.removeDelegate = removeDelegate;
module.exports.deploySingleChoice = deploySingleChoice;
module.exports.addVoter = addVoter;

module.exports.getPolls = getPolls;
module.exports.getCategories = getCategories;
module.exports.getDelegates = getDelegates;
module.exports.getOrganizationInfo = getOrganizationInfo;
module.exports.getCategoriesDelegations = getCategoriesDelegations;
module.exports.getPollsStatus = getPollsStatus;
module.exports.getAllInfo = getAllInfo;
module.exports.removeVoter = removeVoter;
module.exports.getVoterInfo = getVoterInfo;
module.exports.getDelegateInfo = getDelegateInfo;
module.exports.getIdUser = getIdUser;

module.exports.waitTx = waitTx;

function waitTx(web3, txHash, cb) {
    if (!web3.waitTx_filter) {
        web3.waitTxPendingTx = [];
        web3.waitTxFilter = web3.eth.filter('latest', function() {
            var curPendingTx = web3.waitTxPendingTx;
            web3.waitTxPendingTx = [];
            async.eachSeries(curPendingTx, checkTx);
        });
    }
    checkTx({
        web3: web3,
        txHash: txHash,
        cb: cb
    }, function() {});

    function checkTx(tx, cb) {
        web3.eth.getTransactionReceipt(tx.txHash, function(err, res) {
            if (err) return cb(err);
            if (res) {
                tx.cb(null, res);
            } else {
                web3.waitTxPendingTx.push(tx);
            }
            cb();
        });
    }

}

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
                    gas: '4712000',
                    value: web3.toWei(10)
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

function addVoter(web3, organizationAddr, voterAddr, name, amount, cb) {
    var owner;
    var idVoter;
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
            organization.addVoter(voterAddr, name, web3.toWei(amount), { from: owner, gas: 1000000}, function(err, txHash) {
                if (err) return cb(err);

                    waitTx(web3,txHash, function(err, res) {
                        if (err) return cb(err);
                        // log 0 -> CategoryAdded
                        //      topic 0 -> Event Name
                        //      topic 1 -> idVoter
                        idVoter = web3.toBigNumber(res.logs[0].topics[1]).toNumber();
                        cb();
                    });
            });
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, idVoter);
    });
}

function removeVoter(web3, organizationAddr, idVoter, cb) {
    var owner;
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
            organization.removeVoter(idVoter, { from: owner, gas: 500000}, function(err, txHash) {
                if (err) return cb(err);

                    waitTx(web3,txHash, function(err) {
                        if (err) return cb(err);
                        cb();
                    });
            });
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null);
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

                    waitTx(web3,txHash, function(err, res) {
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

function removeCategory(web3, organizationAddr, idCategory, cb) {
    var owner;
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
            organization.removeCategory(idCategory, { from: owner, gas: 500000}, function(err, txHash) {
                if (err) return cb(err);

                    waitTx(web3,txHash, function(err) {
                        if (err) return cb(err);
                        cb();
                    });
            });
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null);
    });
}

function addDelegate(web3, organizationAddr, voterAddr, name, cb) {
    var owner;
    var idDelegate;
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
            organization.addDelegate(voterAddr, name, { from: owner, gas: 1000000}, function(err, txHash) {
                if (err) return cb(err);

                    waitTx(web3,txHash, function(err, res) {
                        if (err) return cb(err);
                        // log 0 -> CategoryAdded
                        //      topic 0 -> Event Name
                        //      topic 1 -> idVoter
                        idDelegate = web3.toBigNumber(res.logs[0].topics[1]).toNumber();
                        cb();
                    });
            });
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null, idDelegate);
    });
}

function removeDelegate(web3, organizationAddr, idDelegate, cb) {
    var owner;
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
            organization.removeDelegate(idDelegate, { from: owner, gas: 500000}, function(err, txHash) {
                if (err) return cb(err);

                    waitTx(web3,txHash, function(err) {
                        if (err) return cb(err);
                        cb();
                    });
            });
        }
    ], function(err) {
        if (err) return cb(err);
        cb(null);
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


                    waitTx(web3,txHash, function(err, res) {
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
                organization.getPoll(idPoll, function(err, res) {
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
                organization.getCategory(idCategory, function(err, res) {
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
                organization.getDelegate(idDelegate, function(err, res) {
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

function getPollsStatus(web3,organizationAddr, idUser, cb) {
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
                        getDelegations(web3, poll.delegateStatusAddr, idUser, function(err, _delegationList) {
                            if (err) return cb(err);
                            pollStatus.delegationList = _delegationList;
                            cb();
                        });
                    },
                    function(cb) {
                        var finalVoter;
                        if (pollStatus.delegationList.length === 0) {
                            finalVoter = idUser;
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
                        getVotingPower(web3, poll.delegateStatusAddr, idUser, function(err, _votingPower) {
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

function getDelegations(web3, delegateStatusAddr, idUser, cb) {
    var delegateStatus = web3.eth.contract(interfaces.delegateStatusAbi).at(delegateStatusAddr);
    var delegationList = [];
    var done = false;
    var it = idUser;
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


function isDelegate(web3, idUser) {
    var idUserBN = web3.toBigNumber(idUser);
    var limitBN = web3.toBigNumber("0x100000000");
    return idUserBN.cmp(limitBN)>0;
}


function getVote(web3, organizationAddr, idPoll, idUser, cb) {
    var vote = {};
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    var nBallots;

    async.series([
        function(cb) {
            organization.getVoteInfo(idPoll,  idUser, function(err, res) {
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
                    organization.getBallotInfo(idPoll, idUser, i, function(err, res) {
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

function getVotingPower(web3, delegateStatusAddr,  idUser, cb) {
    var delegateStatus = web3.eth.contract(interfaces.delegateStatusAbi).at(delegateStatusAddr);
    delegateStatus.getVotingPower(idUser, function(err, res) {
        if (err) return cb(err);
        cb(null, web3.fromWei(res));
    });
}

function getIdUser(web3, organizationAddr,  userAddr, cb) {
    var idUser;
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    organization.voterAddr2Idx(userAddr, function(err,res) {
        if (err) return cb(err);
        idUser = res.toNumber();
        if (idUser) return cb(null, idUser);
        organization.delegateAddr2Idx(userAddr, function(err,res) {
            if (err) return cb(err);
            idUser = res.toNumber();
            cb(null, idUser);
        });
    });
}


function getVoterInfo(web3, organizationAddr, idUser, cb) {
    var voter = {};
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    organization.getVoter(idUser, function(err, res) {
        if (err) return cb(err);
        voter.name=res[0];
        voter.owner = res[1];
        voter.balance = web3.fromWei(res[2]);
        cb(null, voter);
    });
}

function getDelegateInfo(web3, organizationAddr, idUser, cb) {
    var delegate = {};
    var organization = web3.eth.contract(interfaces.organizationAbi).at(organizationAddr);
    organization.getDelegate(idUser, function(err, res) {
        if (err) return cb(err);
        delegate.name=res[0];
        delegate.owner = res[1];
        delegate.deleted = res[2];
        cb(null, delegate);
    });
}


function getAllInfo(web3, organizationAddr, voterAddr, cb) {
    var organizationInfo;
    var idUser;
    async.series([
        function(cb) {
            getOrganizationInfo(web3, organizationAddr, function(err, res) {
                if (err) return cb(err);
                organizationInfo = _.clone(res);
                cb();
            });
        },

        function(cb) {
            getIdUser(web3, organizationAddr,voterAddr, function(err,res) {
                if (err) return cb(err);
                idUser = res;
                cb();
            });
        },
        function(cb) {
            if (idUser == 0) return cb();
            if (isDelegate(web3, idUser)) {
                getDelegateInfo(web3, organizationAddr, idUser, function(err, res) {
                    if (err) return cb(err);
                    organizationInfo.delegate = res;
                    cb();
                });
            } else {
                getVoterInfo(web3, organizationAddr, idUser, function(err, res) {
                    if (err) return cb(err);
                    organizationInfo.voter = res;
                    cb();
                });
            }
        },
        function(cb) {
            if (idUser == 0) return cb();
            getCategoriesDelegations(web3, organizationAddr, idUser, function(err, res) {
                if (err) return cb(err);
                _.each(res, function(delegationList, idCategory) {
                    organizationInfo.categories[idCategory].delegationList = delegationList;
                });
                cb();
            });
        },
        function(cb) {
            if (idUser == 0) return cb();
            getPollsStatus(web3, organizationAddr ,idUser, function(err, res) {
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
