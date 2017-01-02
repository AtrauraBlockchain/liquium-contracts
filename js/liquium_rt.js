"use strict";

var async = require('async');
var _ = require('lodash');
var rlp = require('rlp');

var interfaces = require('./interfaces.js');

module.exports.deployOrganization = deployOrganization;
module.exports.deployDelegateStatusFactory = deployDelegateStatusFactory;
module.exports.getSingleChoiceParams = getSingleChoiceParams;
module.exports.addCategory = addCategory;


module.exports.deploySingleChoice = deploySingleChoice;
module.exports.getPolls = getPolls;

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

function deploySingleChoice(web3, organizationAddr, definition, cb) {
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
                definition.question,
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

var extraParams = {
    "SINGLE_CHOICE": getSingleChoiceParams
};

function getPolls(web3,organizationAddr, cb) {

    var polls = [];
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
                        pollType: pollType,
                        description: res[1],
                        closeDelegateTime: res[2].toNumber(),
                        closeTime: res[3].toNumber(),
                        idCategory: res[4].toNumber(),
                        pollContractAddr: res[5]
                    };
                    polls.push(poll);
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
