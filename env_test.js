
var Web3 = require('web3');
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var BigNumber = require('bignumber.js');

var eth = web3.eth;
var async = require('async');

liquiumRT = require('./js/liquium_rt.js');


var organization;
var singleChoice;

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

pollExample1 = {
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

function addPoll(definition,cb) {
    cb = cb || function() {};
    liquiumRT.deploySingleChoice(web3, organization.address, definition, function(err, _singleChoice , _idPoll) {
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
            addPoll(pollExample1, cb);
        }
    ], cb);
}



