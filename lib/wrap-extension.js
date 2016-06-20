"use strict";

var Halley = require('halley/backbone');
var Promise = Halley.Promise;
var log = require('loglevel');

function wrapExtension(fn) {
  return function(message, callback) {
    var self = this;
    return Promise.try(function() {
      return new Promise(function(resolve) {
        fn.call(self, message, resolve);
      });
    })
    .catch(function(err) {
      log.error("Extension failed: " (err.stack || err));
      return message;
    })
    .then(function(message) {
      callback(message);
    });
  };

}

module.exports = wrapExtension;

