"use strict";

var path = require('path');
var liquiumCompiler = require("./liquium_compiler.js");

liquiumCompiler.compile({}, path.join(__dirname, 'interfaces.js'), function(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    } else {
        process.exit(0);
    }
});

