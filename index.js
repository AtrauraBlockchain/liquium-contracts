"use strict";

var liquimContracts = require('./js/liquium_rt.js');

module.exports = liquimContracts;

if (typeof window !== "undefined") {
    window.liquiumContracts = liquimContracts;
}
