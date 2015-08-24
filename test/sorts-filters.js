/*jslint node:true, unused:true*/
/*global describe:true, it:true */

'use strict';

var roomSort = require('../lib/sorts-filters');
var Backbone = require('backbone');
var assert = require('assert');

var VERY_VERY_OLD = new Date('1066-10-29T12:00:20.250Z');
var VERY_OLD = new Date('1492-10-29T12:00:20.250Z');
var OLD = new Date('1985-10-29T12:00:20.250Z');
var NEW = new Date('2014-10-29T12:00:20.250Z');

describe('room-sort', function() {

  describe('favourites', function() {
    it('filters out non favourites', function() {
      var collection = new Backbone.Collection([
        { id: 1, favourite: 1 },
        { id: 2 }
      ]);

      var filteredCollection = collection.filter(roomSort.model.favourites.filter);

      assert.deepEqual(id(filteredCollection), [1]);
    });

    it('sorts by favourite rank', function() {
      var collection = new Backbone.Collection([
        { id: 1, favourite: 3 },
        { id: 2, favourite: 1 },
        { id: 3, favourite: 2 }
      ]);

      collection.comparator = roomSort.model.favourites.sort;

      var filteredCollection = collection.sort();

      assert.deepEqual(id(filteredCollection), [2, 3, 1]);
    });
  });

  describe('recents', function() {
    it('filters out favourites', function() {
      var collection = new Backbone.Collection([
        { id: 1, favourite: 1 },
        { id: 2, unreadItems: 1 }
      ]);

      var filteredCollection = collection.filter(roomSort.model.recents.filter);

      assert.deepEqual(id(filteredCollection), [2]);
    });

    describe('sort', function() {

      var RecentsCollection = Backbone.Collection.extend({ comparator: roomSort.model.recents.sort });

      describe('@mentions', function() {

        it('puts them above unread rooms', function() {
          var collection = new RecentsCollection([
            { id: 'unread', unreadItems: 2 },
            { id: 'mentioned', unreadItems: 1, mentions: 1 }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['mentioned', 'unread']);
        });

        it('sorts multiple @mentioned rooms by time of last access', function() {
          var collection = new RecentsCollection([
            { id: 'old_mentions', unreadItems: 3, mentions: 5, lastAccessTime: OLD },
            { id: 'new_mentions', unreadItems: 5, mentions: 3, lastAccessTime: NEW }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['new_mentions', 'old_mentions']);
        });

        it('puts @mentioned rooms that havent been accessed at the bottom', function() {
          var collection = new RecentsCollection([
            { id: 'never_accessed_mentions', unreadItems: 1, mentions: 1 },
            { id: 'accessed_mentions', unreadItems: 1, mentions: 1, lastAccessTime: NEW }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['accessed_mentions', 'never_accessed_mentions']);
        });

        it('doesnt move rooms once they have been accessed', function() {
          var room = new Backbone.Model({
            id: 'room',
            unreadItems: 5,
            mentions: 3,
            hadUnreadItemsOnLoad: true,
            hadMentionsOnLoad: true,
            lastAccessTime: OLD,
            lastAccessTimeOnLoad: OLD
          });
          var roomToUpdate = new Backbone.Model({
            id: 'room_to_update',
            unreadItems: 3,
            mentions: 1,
            hadUnreadItemsOnLoad: true,
            hadMentionsOnLoad: true,
            lastAccessTime: VERY_OLD,
            lastAccessTimeOnLoad: VERY_OLD
          });
          var collection = new RecentsCollection([room, roomToUpdate]);

          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update']);

          roomToUpdate.set('lastAccessTime', NEW);
          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update']);
        });

        it('doesnt move rooms once they have been read', function() {
          var room = new Backbone.Model({
            id: 'room',
            unreadItems: 1,
            mentions: 1,
            hadUnreadItemsOnLoad: true,
            hadMentionsOnLoad: true,
            lastAccessTime: OLD,
            lastAccessTimeOnLoad: OLD
          });
          var roomToUpdate = new Backbone.Model({
            id: 'room_to_update',
            unreadItems: 1,
            mentions: 1,
            hadUnreadItemsOnLoad: true,
            hadMentionsOnLoad: true,
            lastAccessTime: VERY_OLD,
            lastAccessTimeOnLoad: VERY_OLD
          });
          var veryVeryOldRoom = new Backbone.Model({
            id: 'very_very_old_room',
            unreadItems: 1,
            mentions: 1,
            hadUnreadItemsOnLoad: true,
            hadMentionsOnLoad: true,
            lastAccessTime: VERY_VERY_OLD,
            lastAccessTimeOnLoad: VERY_VERY_OLD
          });
          var collection = new RecentsCollection([room, roomToUpdate, veryVeryOldRoom]);

          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update', 'very_very_old_room']);

          roomToUpdate.set('lastAccessTime', NEW);
          roomToUpdate.set('unreadItems', 0);
          roomToUpdate.set('mentions', 0);
          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update', 'very_very_old_room']);
        });
      });

      describe('unread', function() {
        it('puts them above regular rooms', function() {
          var collection = new RecentsCollection([
            { id: 'regular' },
            { id: 'unread', unreadItems: 1 }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['unread', 'regular']);
        });

        it('puts new unreads above rooms that had unreads (issue troupe/gitter-webapp#368)', function() {
          var collection = new RecentsCollection([
            { id: 'regular' },
            { id: 'was_unread', hadUnreadItemsOnLoad: true, lastAccessTime: OLD },
            { id: 'unread', unreadItems: 1, escalationTime: NEW }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['unread', 'was_unread', 'regular']);
        });

        it('sorts multiple unread rooms by time of last access', function() {
          var collection = new RecentsCollection([
            { id: 'old_unread', unreadItems: 5, lastAccessTime: OLD },
            { id: 'new_unread', unreadItems: 1, lastAccessTime: NEW }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['new_unread', 'old_unread']);
        });

        it('puts unread rooms that havent been accessed at the bottom', function() {
          var collection = new RecentsCollection([
            { id: 'never_accessed_unread', unreadItems: 2 },
            { id: 'accessed_unread', unreadItems: 1, lastAccessTime: NEW }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['accessed_unread', 'never_accessed_unread']);
        });

        it('doesnt move rooms once they have been accessed', function() {
          var room = new Backbone.Model({
            id: 'room',
            unreadItems: 5,
            hadUnreadItemsOnLoad: true,
            lastAccessTime: OLD,
            lastAccessTimeOnLoad: OLD
          });
          var roomToUpdate = new Backbone.Model({
            id: 'room_to_update',
            unreadItems: 3,
            hadUnreadItemsOnLoad: true,
            lastAccessTime: VERY_OLD,
            lastAccessTimeOnLoad: VERY_OLD
          });
          var collection = new RecentsCollection([room, roomToUpdate]);

          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update']);

          roomToUpdate.set('lastAccessTime', NEW);
          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update']);
        });

        it('doesnt move rooms once they have been read', function() {
          var room = new Backbone.Model({
            id: 'room',
            unreadItems: 1,
            hadUnreadItemsOnLoad: true,
            lastAccessTime: OLD,
            lastAccessTimeOnLoad: OLD
          });
          var roomToUpdate = new Backbone.Model({
            id: 'room_to_update',
            unreadItems: 1,
            hadUnreadItemsOnLoad: true,
            lastAccessTime: VERY_OLD,
            lastAccessTimeOnLoad: VERY_OLD
          });
          var veryVeryOldRoom = new Backbone.Model({
            id: 'very_very_old_room',
            unreadItems: 1,
            hadUnreadItemsOnLoad: true,
            lastAccessTime: VERY_VERY_OLD,
            lastAccessTimeOnLoad: VERY_VERY_OLD
          });
          var collection = new RecentsCollection([room, roomToUpdate, veryVeryOldRoom]);

          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update', 'very_very_old_room']);

          roomToUpdate.set('lastAccessTime', NEW);
          roomToUpdate.set('unreadItems', 0);
          roomToUpdate.set('lastUnreadItemTime', NEW);
          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update', 'very_very_old_room']);
        });

      });

      describe('regular', function() {
        it('sorts multiple rooms by time of last access', function() {
          var collection = new RecentsCollection([
            { id: 'old_room', lastAccessTime: OLD },
            { id: 'new_room', lastAccessTime: NEW }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['new_room', 'old_room']);
        });

        it('puts rooms that havent been accessed at the bottom', function() {
          var collection = new RecentsCollection([
            { id: 'never_accessed_room' },
            { id: 'accessed_room', lastAccessTime: NEW }
          ]);

          collection.sort();

          assert.deepEqual(id(collection), ['accessed_room', 'never_accessed_room']);
        });

        it('doesnt move rooms if they are later accessed', function() {
          var room = new Backbone.Model({ id: 'room', lastAccessTime: OLD, lastAccessTimeOnLoad: OLD });
          var roomToUpdate = new Backbone.Model({ id: 'room_to_update', lastAccessTime: VERY_OLD, lastAccessTimeOnLoad: VERY_OLD });
          var collection = new RecentsCollection([room, roomToUpdate]);

          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update']);

          roomToUpdate.set('lastAccessTime', NEW);
          collection.sort();

          assert.deepEqual(id(collection), ['room', 'room_to_update']);
        });

        it('promotes rooms if new unread messages arrive', function() {
          var room = new Backbone.Model({ id: 'room', lastAccessTime: OLD });
          var roomToUpdate = new Backbone.Model({ id: 'room_to_update', lastAccessTime: VERY_OLD });
          var collection = new RecentsCollection([room, roomToUpdate]);

          roomToUpdate.set('unreadItems', 1);
          roomToUpdate.set('lastUnreadItemTime', NEW);

          collection.sort();

          assert.deepEqual(id(collection), ['room_to_update', 'room']);
        });

      });

    });

  });

});

function id(collection) {
  return collection.map(function(model) {
    return model.id;
  });
}
