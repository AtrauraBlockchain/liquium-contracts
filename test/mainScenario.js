"use strict";

var liquiumCompiler = require('../js/liquium_compiler.js');
var liquiumRT;
var interfaces;
var ethConnector = require('ethconnector');
var web3;
var path = require('path');

var assert = require("assert"); // node.js core module
var async = require('async');

var verbose = true;

describe('Normal Scenario Liquium test', function(){
    var organization;
    var owner;
    var voter1;
//    var voter2;
//    var voter3;
    var delegate1;
//    var delegate2;
//    var delegate3;
    var singleChoice;
    var idPoll;
    var delegateStatus;
    var ballots = [];
    var now = Math.floor(new Date().getTime() /1000);

    before(function(done) {
//        ethConnector.init('rpc', function(err) {
        ethConnector.init('testrpc' ,{gasLimit: 4700000},function(err) {
            if (err) return done(err);
            web3 = ethConnector.web3;
            owner = ethConnector.accounts[0];
            voter1 = ethConnector.accounts[1];
//            voter2 = ethConnector.accounts[2];
//            voter3 = ethConnector.accounts[3];
            delegate1 = ethConnector.accounts[4];
//            delegate2 = ethConnector.accounts[5];
//            delegate3 = ethConnector.accounts[6];
            done();
        });
    });
    it('should compile all the contracts ', function(done){
        this.timeout(2000000);
        liquiumCompiler.compile({}, path.join(__dirname, '../js/interfaces.js'), function(err) {
            assert.ifError(err);
            liquiumRT = require('../js/liquium_rt.js');
            interfaces = require('../js/interfaces.js');
            done();
        });
    });
    it('should deploy all the contracts ', function(done){
        this.timeout(20000);

        liquiumRT.deployOrganization(web3, ethConnector.accounts[0], {}, function(err, _organization) {
            assert.ifError(err);
            assert.ok(_organization.address);
            organization = _organization;
            done();
        });
    });
    it('Should create a Category', function(done) {
        organization.addCategory("Cat1", 0, {from: owner, gas: 1000000}, function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                    organization.nCategories(function(err, res) {
                        assert.ifError(err);
                        assert.equal(res, 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.categories(1, function(err, res) {
                        assert.ifError(err);
                        assert.equal(res[0], "Cat1");
                        cb();
                    });
                }
            ],done);
        });
    });
    it('Should create a voter', function(done) {
        organization.addVoter(voter1, web3.toWei(1), {from: owner, gas: 200000},function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                    organization.balanceOf(voter1, function(err, res) {
                        assert.ifError(err);
                        assert.equal(web3.fromWei(res).toNumber(), 1);
                        cb();
                    });
                },
            ],done);
        });
    });
    it('Should create a Poll', function(done) {
        this.timeout(200000000);
        var closeDelegateTime = now + 86400*7;
        var closeTime = now + 86400*14;
        liquiumRT.deploySingleChoice(web3, organization.address, {
            question: "Question Example",
            options: ["Option1", "Option2", "Option3"],
            closeDelegateTime: closeDelegateTime,
            closeTime: closeTime,
            categoryId: 1,
        }, function(err, _singleChoice, _idPoll) {
            assert.ifError(err);
            assert.ok(_singleChoice.address);
            assert.equal(_idPoll, 1);
            singleChoice = _singleChoice;
            idPoll = _idPoll;
            async.series([
                function(cb) {
                    singleChoice.question(function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, "Question Example");
                        cb();
                    });
                },
                function(cb) {
                    singleChoice.nOptions(function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, 3);
                        cb();
                    });
                },
                function(cb) {
                    singleChoice.options(0, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, "Option1");
                        cb();
                    });
                },
                function(cb) {
                    singleChoice.options(1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, "Option2");
                        cb();
                    });
                },
                function(cb) {
                    singleChoice.options(2, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, "Option3");
                        cb();
                    });
                },
                function(cb) {
                    organization.nPolls(function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.polls(idPoll, function(err, res) {
                        if (err) return cb(err);
                        var pollType = web3.toAscii(res[0]);
                        pollType = pollType.replace(/\0/g, '');
                        assert.equal(pollType, "SINGLE_CHOICE");
                        assert.equal(res[1], "Question Example");
                        assert.equal(res[2], closeDelegateTime);
                        assert.equal(res[3], closeTime);
                        assert.equal(res[4], 1);
                        assert.equal(res[5], singleChoice.address);

                        delegateStatus = web3.eth.contract(interfaces.delegateStatusAbi).at(res[6]);
                        cb();
                    });
                },
                function(cb) {
                    delegateStatus.owner(function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, organization.address);
                        cb();
                    });
                }
            ],done);
        });
    });
    it('should get Polls', function(done) {
        this.timeout(200000000);
        liquiumRT.getPolls(web3, organization.address, function(err, polls) {
            assert.ifError(err);
            log(JSON.stringify(polls,null,2));
            done();
        });
    });
    it('should get Ballots', function(done) {
        async.series([
            function(cb) {
                singleChoice.getBallot(0, function(err, res) {
                    if (err) return cb(err);
                    ballots[0] = res;
                    cb();
                });
            },
            function(cb) {
                singleChoice.getBallot(1, function(err, res) {
                    if (err) return cb(err);
                    ballots[1] = res;
                    cb();
                });
            },
            function(cb) {
                singleChoice.getBallot(2, function(err, res) {
                    if (err) return cb(err);
                    ballots[2] = res;
                    cb();
                });
            },
        ], done);
    });
    it('Should vote', function(done) {
        this.timeout(200000000);
        organization.vote(idPoll, [ballots[1]], [web3.toWei(1)], {from: voter1, gas: 2000000}, function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                    singleChoice.result(1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(web3.fromWei(res).toNumber(), 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.getVoteInfo(idPoll, voter1, function(err,res) {
                        if (err) return cb(err);
                        assert(res[0] > now);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 1);
                        assert.equal(res[2], 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.getBallotInfo(idPoll, voter1, 0, function(err,res) {
                        if (err) return cb(err);
                        assert.equal(res[0], ballots[1]);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 1);
                        cb();
                    });
                }
            ], done);
        });
    });
    it('Should unvote', function(done) {
        this.timeout(200000000);
        organization.unvote(idPoll, {from: voter1, gas: 2000000}, function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                    singleChoice.result(1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(web3.fromWei(res).toNumber(), 0);
                        cb();
                    });
                },
                function(cb) {
                    organization.getVoteInfo(idPoll, voter1, function(err,res) {
                        if (err) return cb(err);
                        assert.equal(res[0], 0);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 0);
                        assert.equal(res[2], 0);
                        cb();
                    });
                }
            ], done);
        });
    });
    it('Should create a delegate', function(done) {
        this.timeout(200000000);
        organization.addDelegate("Delegate1", {from: delegate1, gas: 300000}, function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                    organization.delegates(1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res[0], "Delegate1");
                        assert.equal(res[1], delegate1);
                        assert.equal(res[2], false);
                        cb();
                    });
                }
            ], done);
        });
    });
    it('Should The delegate setup the vote', function(done) {
        this.timeout(200000000);
        organization.dVote(1, idPoll, [ballots[1]], [web3.toWei(1)], "Motivation1", {from: delegate1, gas: 2000000}, function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                    singleChoice.result(1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(web3.fromWei(res).toNumber(), 0);
                        cb();
                    });
                },
                function(cb) {
                    organization.dGetVoteInfo(idPoll, 1, function(err,res) {
                        if (err) return cb(err);
                        assert(res[0] > now);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 0);
                        assert.equal(res[2], 1);
                        assert.equal(res[3], "Motivation1");
                        cb();
                    });
                },
                function(cb) {
                    organization.dGetBallotInfo(idPoll, 1, 0, function(err,res) {
                        if (err) return cb(err);
                        assert.equal(res[0], ballots[1]);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 1);
                        cb();
                    });
                }
            ], done);
        });
    });
    it('Should delegate voter1 in delegate1 for category 1', function(done) {
        this.timeout(200000000);
        organization.setDelegates([1], [1], {from: voter1, gas: 1000000}, function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                    organization.getCategoryDelegate(1, voter1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.getPollDelegate(idPoll, voter1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, 1);
                        cb();
                    });
                },
                function(cb) {
                    singleChoice.result(1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(web3.fromWei(res).toNumber(), 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.dGetVoteInfo(idPoll, 1, function(err,res) {
                        if (err) return cb(err);
                        assert(res[0] > now);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 1);
                        assert.equal(res[2], 1);
                        assert.equal(res[3], "Motivation1");
                        cb();
                    });
                }
            ], done);
        });
    });
    it('Should voter should change delegate vote', function(done) {
        this.timeout(200000000);
        organization.vote(idPoll, [ballots[2]], [web3.toWei(1)], {from: voter1, gas: 2000000}, function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                    singleChoice.result(1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(web3.fromWei(res).toNumber(), 0);
                        cb();
                    });
                },
                function(cb) {
                    singleChoice.result(2, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(web3.fromWei(res).toNumber(), 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.getCategoryDelegate(1, voter1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.getPollDelegate(idPoll, voter1, function(err, res) {
                        if (err) return cb(err);
                        assert.equal(res, 0);
                        cb();
                    });
                },
                function(cb) {
                    organization.getVoteInfo(idPoll, voter1, function(err,res) {
                        if (err) return cb(err);
                        assert(res[0] > now);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 1);
                        assert.equal(res[2], 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.getBallotInfo(idPoll, voter1, 0, function(err,res) {
                        if (err) return cb(err);
                        assert.equal(res[0], ballots[2]);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 1);
                        cb();
                    });
                },
                function(cb) {
                    organization.dGetVoteInfo(idPoll, 1, function(err,res) {
                        if (err) return cb(err);
                        assert(res[0] > now);
                        assert.equal(web3.fromWei(res[1]).toNumber(), 0);
                        assert.equal(res[2], 1);
                        assert.equal(res[3], "Motivation1");
                        cb();
                    });
                }
            ], done);
        });
    });

/*
    function bcDelay(secs, cb) {
        send("evm_increaseTime", [secs], function(err, result) {
            if (err) return cb(err);

      // Mine a block so new time is recorded.
            send("evm_mine", function(err, result) {
                if (err) return cb(err);
                cb();
            });
        });
    }
*/
    function log(S) {
        if (verbose) {
            console.log(S);
        }
    }
/*
        // CALL a low level rpc
    function send(method, params, callback) {
        if (typeof params == "function") {
          callback = params;
          params = [];
        }

        ethConnector.web3.currentProvider.sendAsync({
          jsonrpc: "2.0",
          method: method,
          params: params || [],
          id: new Date().getTime()
        }, callback);
    }
*/
/*
    function printTests(cb) {
        async.series([
            function(cb) {
                organization.test1(function(err,res) {
                    if (err) return cb(err);
                    log("test1: "+res.toString());
                    cb();
                });
            },
            function(cb) {
                organization.test2(function(err,res) {
                    if (err) return cb(err);
                    log("test2: "+res);
                    cb();
                });
            }
        ],cb);
    }
*/
});
