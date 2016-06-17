"use strict";

var log = require('loglevel');

function wrapExtension(fn) {
  return function(message, callback) {
    var self = this;
    try {
      fn.call(self, message, callback);
    } catch(err) {
      log.error("Extension failed: " + (err.stack || err));
      callback(message);
    }
  }
}

module.exports = wrapExtension;

