"use strict";

var Web3 = require('web3');
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var BigNumber = require('bignumber.js');

var eth = web3.eth;
var async = require('async');

var liquiumRT = require('./js/liquium_rt.js');


var organization;
var singleChoice;
var idCategory;
var idDelegate;
var idPoll;

function deployOrganization(cb) {
    cb = cb || function() {};
    liquiumRT.deployOrganization(web3, eth.accounts[0], {}, function(err, _organization) {
        if (err) {
            console.log(err);
            return cb(err);
        }
        organization = _organization;
        console.log("Organization deployed at: "+organization.address);
        cb();
    });
}

function addCategory(catName, cb) {
    cb = cb || function() {};
    liquiumRT.addCategory(web3, organization.address, catName, 0, function(err, _idCategory) {
        if (err) {
            console.log(err);
            return cb(err);
        }
        idCategory = _idCategory;
        console.log("Category created correctly. idCategory = " + idCategory);
        cb();
    });
}

var pollExample1 = {
    question: "Question 1",
    options: [
        "Option1",
        "Option2",
        "Option3"
    ],
    closeDelegateTime: Math.floor(new Date().getTime()/1000) + 86400*7,
    closeTime: Math.floor(new Date().getTime()/1000) + 86400*14,
    idCategory: 1
};

function addPoll(title, definition,cb) {
    cb = cb || function() {};
    liquiumRT.deploySingleChoice(web3, organization.address, title, definition, function(err, _singleChoice , _idPoll) {
        if (err) {
            console.log(err);
            return cb(err);
        }
        singleChoice = _singleChoice;
        idPoll = _idPoll;
        console.log("Poll deployed correctly. idPoll = " + idPoll);
        cb();
    });
}

function addVoter(account, name, cb) {
    cb = cb || function() {};
    organization.addVoter(account, name, web3.toWei(1), {from: eth.accounts[0], gas:500000}, function(err, res) {
        if (err) {
            console.log(err);
            return cb(err);
        }
        console.log("Voter added");
        cb();
    });
}

function addDelegate(name, account, cb) {
    cb = cb || function() {};
    liquiumRT.addDelegate(web3, organization.address, name, account, function(err, _idDelegate) {
        if (err) {
            console.log(err);
            return cb(err);
        }
        idDelegate = _idDelegate;
        console.log("Delegate created correctly. idDelegate = " + idDelegate);
        cb();
    });
}

function deployExample(cb) {
    cb = cb || function() {};
    async.series([
        function(cb) {
            deployOrganization(cb);
        },
        function(cb) {
            addCategory("Category1", cb);
        },
        function(cb) {
            addPoll("Poll1", pollExample1, cb);
        },
        function(cb) {
            addVoter(web3.eth.accounts[1], "Voter1", cb);
        },
        function(cb) {
            addDelegate("Delegate1", web3.eth.accounts[2], cb);
        }
    ], cb);
}


