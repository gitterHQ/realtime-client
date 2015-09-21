"use strict";

var LiveCollection = require('./live-collection');
var RoomModel      = require('./room-model');

module.exports = LiveCollection.extend({
  model: RoomModel,
  urlTemplate: '/v1/user/:userId/rooms',
  initialize: function(models, options) { // jshint unused:true
    this.userId = options.userId;
    this.listenTo(this, 'change:favourite', this.reorderFavs);
    this.listenTo(this, 'change:lastAccessTime change:lurk', this.resetActivity);
  },

  resetActivity: function(model) {
    if(model.changed.lastAccessTime && model.get('lastAccessTime')) {
      model.unset('activity');
    }

    if(model.changed.lurk && !model.get('lurk')) {
      model.unset('activity');
    }
  },

  reorderFavs: function(model) {
    /**
     * We need to do some special reordering in the model of a favourite being positioned
     * This is to mirror the changes happening on the server
     * @see recent-room-service.js@addTroupeAsFavouriteInPosition
     */

    /* This only applies when a fav has been set */
    if(!model.changed || !model.changed.favourite || this.reordering) {
      return;
    }

    this.reordering = true;

    var favourite = model.changed.favourite;

    var forUpdate = this
                      .map(function(room) {
                        return { id: room.id, favourite: room.get('favourite') };
                      })
                      .filter(function(room) {
                        return room.favourite >= favourite && room.id !== model.id;
                      });

    forUpdate.sort(function(a, b) {
      return a.favourite - b.favourite;
    });

    var next = favourite;
    for(var i = 0; i < forUpdate.length; i++) {
      var item = forUpdate[i];

      if(item.favourite > next) {
        forUpdate.splice(i, forUpdate.length);
        break;
      }

      item.favourite++;
      next = item.favourite;
    }

    var self = this;
    for(var j = forUpdate.length - 1; j >= 0; j--) {
      var r = forUpdate[j];
      var id = r.id;
      var value = r.favourite;
      var t = self.get(id);
      t.set('favourite', value, { silent: true });
    }

    delete this.reordering;
  }
});
