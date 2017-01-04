"use strict";

var liquimContracts = require('./js/liquium_rt.js');

module.exports = liquimContracts;

if (window) {
    window.liquiumContracts = liquimContracts;
}
