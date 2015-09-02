'use strict';

var Backbone = require('backbone');

// Create a context model for backwards compatibility for clients
// which have not supplied one. The default context model only binds
// against userId, and only does so once
module.exports = function(client, suppliedUserId) {
  var userId = suppliedUserId || client.getUserId();
  var contextModel = new Backbone.Model({ userId: userId });

  if (!userId) {
    client.on('change:userId', function(userId) {
      contextModel.set({ userId: userId });
    });
  }

  return contextModel;
};
