"use strict";

var Backbone = require('backbone');
var moment = require('moment');

module.exports = Backbone.Model.extend({
  idAttribute: "id",
  initialize: function(options) {

    // this model will be cloned and destroyed with every update.
    // only the original will be created with every attribute in the options object.
    var isOriginalModel = !!options.url;

    if (isOriginalModel) {

      // we need to set these attributes when the original is created.
      // if we set them on every clone, then all these attributes would change when navigating to a room.
      // this would make the left menu room list reorder itself all the time.

      // we may not always have a lastAccessTime
      var time = this.get('lastAccessTime');

      if (time) {
        this.set('lastAccessTimeOnLoad', time.clone());
      } else if(this.get('unreadItems')) {
        // room has been added to the list but the user has never visited it.
        // probably a fresh mention in a room.
        // better escalate this room to be highest on the list.
        this.set('escalationTime', moment());
      }

      if(this.get('unreadItems')) {
        this.set('hadUnreadItemsOnLoad', true);
      }

      if(this.get('mentions')) {
        this.set('hadMentionsOnLoad', true);
      }
    }

    this.listenTo(this, 'change:mentions', function (model, mentions) { // jshint unused:true
      if(!this.previous('mentions') && mentions) {
        // changed from 0 mentions to 1+, so escalate this room to be highest on the list
        this.set('escalationTime', moment());
      }
    });

    this.listenTo(this, 'change:unreadItems', function (model, unreadItems) { // jshint unused:true
      if(!this.previous('unreadItems') && unreadItems) {
        // changed from 0 unread to 1+, so escalate this room to be highest on the list
        this.set('escalationTime', moment());
      }
    });

  },

  parse: function(message) {
    if(typeof message.lastAccessTime === 'string') {
      message.lastAccessTime = moment(message.lastAccessTime, moment.defaultFormat);
    }

    return message;
  }
}, { modelType: 'room' });
