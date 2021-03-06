"use strict";

var Web3 = require('web3');
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var BigNumber = require('bignumber.js');

var eth = web3.eth;
var async = require('async');

var liquiumRT = require('./liquium_rt.js');

var organizationAddr = '0x5b1869d9a4c187f2eaa108f3062412ecf0526b24';
liquiumRT.getAllInfo(web3, organizationAddr, eth.accounts[1], function(err,st) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
    console.log(JSON.stringify(st, null, 2));
    process.exit(0);
});


