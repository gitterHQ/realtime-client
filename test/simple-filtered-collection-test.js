'use strict';

var assert = require('assert');
var Backbone = require('backbone');
var SimpleFilteredCollection = require('../lib/simple-filtered-collection');

function bindEvents(events, collection) {
  collection.on('add', function(model) {
    events.push({ type: 'add', i: model.get('i') });
  });

  collection.on('remove', function(model) {
    events.push({ type: 'remove', i: model.get('i') });
  });

  collection.on('reset', function() {
    events.push({ type: 'reset' });
  });

  collection.on('change', function(model) {
    events.push({ type: 'change', i: model.get('i'), prevI: model.previous('i') });
  });
}

describe('SimpleFilteredCollection', function() {

  describe('adding and removing', function() {

    var baseCollection;
    var filteredCollection;
    var events;

    beforeEach(function() {
      events = [];
      baseCollection = new Backbone.Collection([]);
      filteredCollection = new SimpleFilteredCollection([], {
        collection: baseCollection,
        filter: function(model) {
          return model.get('i') % 2 === 0;
        }
      });

      bindEvents(events, filteredCollection);
    });

    it('should handle an empty collection', function() {
      assert.strictEqual(filteredCollection.length, 0);
      assert.deepEqual(events, []);
    });

    it('should handle adds that match', function() {
      baseCollection.add({ i: 0 });
      assert.strictEqual(filteredCollection.length, 1);
      assert.deepEqual(events, [
        { type: 'add', i: 0 }
      ]);
    });

    it('should handle adds that do not match match', function() {
      baseCollection.add({ i: 1 })
      assert.strictEqual(filteredCollection.length, 0);
      assert.deepEqual(events, []);
    });

    it('should handle items being changed from a match to not a match', function() {
      var model = new Backbone.Model({ i: 1 })
      baseCollection.add(model);
      assert.strictEqual(filteredCollection.length, 0);
      events.length = 0;

      model.set({ i: 2 });
      assert.strictEqual(filteredCollection.length, 1);
      assert.deepEqual(events, [
        { type: 'add', i: 2 }
      ]);
    });

    it('should handle items being changed from a non-match to a match', function() {
      var model = new Backbone.Model({ i: 2 })
      baseCollection.add(model);
      assert.strictEqual(filteredCollection.length, 1);
      events.length = 0;

      model.set({ i: 1 });
      assert.strictEqual(filteredCollection.length, 0);
      assert.deepEqual(events, [
        { type: 'remove', i: 1 }
      ]);
    });

    it('should handle resets', function() {
      baseCollection.add({ i: 0 });
      assert.strictEqual(filteredCollection.length, 1);
      events.length = 0;

      baseCollection.reset();
      assert.strictEqual(filteredCollection.length, 0);

      assert.deepEqual(events, [
        { type: 'reset' }
      ]);
    })

    it('should handle populated resets', function() {
      baseCollection.add({ i: 0 });
      assert.strictEqual(filteredCollection.length, 1);
      events.length = 0;

      baseCollection.reset([{ i: 0 }, { i: 1 }, { i: 2 }]);
      assert.strictEqual(filteredCollection.length, 2);
      assert.deepEqual(events, [
        { type: 'reset' }
      ]);
    });

    it('should handle filter changes ', function() {
      baseCollection.add({ i: 0 });
      baseCollection.add({ i: 1 });
      baseCollection.add({ i: 2 });
      baseCollection.add({ i: 3 });
      baseCollection.add({ i: 4 });
      baseCollection.add({ i: 5 });
      baseCollection.add({ i: 6 });

      assert.strictEqual(filteredCollection.length, 4);
      events.length = 0;

      filteredCollection.setFilter(function() {
        return false;
      });

      assert.strictEqual(filteredCollection.length, 0);

      assert.deepEqual(events, [
        { type: 'remove', i: 6 },
        { type: 'remove', i: 4 },
        { type: 'remove', i: 2 },
        { type: 'remove', i: 0 }
      ]);

      events.length = 0;

      filteredCollection.setFilter(function() {
        return true;
      });

      assert.strictEqual(filteredCollection.length, 7);

      assert.deepEqual(events, [
        { type: 'add', i: 0 },
        { type: 'add', i: 1 },
        { type: 'add', i: 2 },
        { type: 'add', i: 3 },
        { type: 'add', i: 4 },
        { type: 'add', i: 5 },
        { type: 'add', i: 6 },
      ]);
    })

    it('should handle partial filter changes ', function() {
      baseCollection.add({ i: 0 });
      baseCollection.add({ i: 1 });
      baseCollection.add({ i: 2 });
      baseCollection.add({ i: 3 });
      baseCollection.add({ i: 4 });
      baseCollection.add({ i: 5 });
      baseCollection.add({ i: 6 });

      assert.strictEqual(filteredCollection.length, 4);
      events.length = 0;

      filteredCollection.setFilter(function(model) {
        return model.get('i') % 3 === 0;
      });

      assert.strictEqual(filteredCollection.length, 3);

      assert.deepEqual(events, [
        { type: 'remove', i: 4 },
        { type: 'remove', i: 2 },
        { type: 'add', i: 3 },
      ]);
    });
  });


  describe('sorting', function() {
    describe('no autoResort', function() {
      var baseCollection;
      var filteredCollection;
      var items;

      beforeEach(function() {
        baseCollection = new Backbone.Collection(items, {
          comparator: function(a, b) {
            return a.get('i') - b.get('i');
          }
        });

        filteredCollection = new SimpleFilteredCollection([], {
          collection: baseCollection,
          filter: function(model) {
            return model.get('i') % 2 === 0;
          },
          comparator: function(a, b) {
            return b.get('i') - a.get('i');
          }
        });
      });

      describe('without preloaded', function() {
        before(function() {
          items = [];
        });

        it('should allow alternative sorting to its parent', function() {
          baseCollection.add({ i: 3 });
          baseCollection.add({ i: 5 });
          baseCollection.add({ i: 4 });
          baseCollection.add({ i: 2 });
          baseCollection.add({ i: 1 });

          assert.strictEqual(baseCollection.length, 5);
          assert.strictEqual(filteredCollection.length, 2);

          var basePluck = baseCollection.pluck('i');
          assert.deepEqual(basePluck, [1, 2, 3, 4, 5]);

          var filteredPluck = filteredCollection.pluck('i');
          assert.deepEqual(filteredPluck, [4, 2]);
        });

      });

      describe('preloaded', function() {
        before(function() {
          items = [{ i: 7 }, { i: 8 }, { i: 100 }];
        });

        it('should allow alternative sorting to its parent', function() {
          baseCollection.add({ i: 3 });
          baseCollection.add({ i: 5 });
          baseCollection.add({ i: 4 });
          baseCollection.add({ i: 2 });
          baseCollection.add({ i: 1 });

          assert.strictEqual(baseCollection.length, 8);
          assert.strictEqual(filteredCollection.length, 4);

          var basePluck = baseCollection.pluck('i');
          assert.deepEqual(basePluck, [1, 2, 3, 4, 5, 7, 8, 100]);

          var filteredPluck = filteredCollection.pluck('i');
          assert.deepEqual(filteredPluck, [100, 8, 4, 2]);
        });

      });
    });

    describe('with autoResort', function() {
      var baseCollection;
      var filteredCollection;
      var items;
      var events;

      beforeEach(function() {
        items = [];
        events = [];

        baseCollection = new Backbone.Collection(items, {
          comparator: function(a, b) {
            return a.get('i') - b.get('i');
          }
        });

        filteredCollection = new SimpleFilteredCollection([], {
          collection: baseCollection,
          autoResort: true,
          filter: function(model) {
            return model.get('i') % 2 === 0;
          },
          comparator: function(a, b) {
            return b.get('i') - a.get('i');
          }
        });

        bindEvents(events, filteredCollection);
      });

      it('should auto resort', function() {
        var i6 = baseCollection.add({ i: 6 });
        baseCollection.add({ i: 10 });
        baseCollection.add({ i: 8 });
        baseCollection.add({ i: 4 });
        baseCollection.add({ i: 2 });

        var filteredPluck = filteredCollection.pluck('i');
        assert.deepEqual(filteredPluck, [10, 8, 6, 4, 2]);

        events.length = 0;

        i6.set({ i: 12 });

        assert.deepEqual(events, [{
            "i": 12,
            "type": "remove"
          }, {
            "i": 12,
            "type": "add"
          }, {
            "i": 12,
            "prevI": 6,
            "type": "change"
          }
        ]);

        filteredPluck = filteredCollection.pluck('i');
        assert.deepEqual(filteredPluck, [12, 10, 8, 4, 2]);

        events.length = 0;

        i6.set({ i: 0 });
        filteredPluck = filteredCollection.pluck('i');
        assert.deepEqual(filteredPluck, [10, 8, 4, 2, 0]);

        assert.deepEqual(events, [{
            "i": 0,
            "type": "remove"
          }, {
            "i": 0,
            "type": "add"
          }, {
            "i": 0,
            "prevI": 12,
            "type": "change"
          }
        ]);

      });

      it('should not move models when the change does not affect the comparator', function() {
        var i6 = baseCollection.add({ i: 6 });
        baseCollection.add({ i: 10 });
        baseCollection.add({ i: 8 });
        baseCollection.add({ i: 4 });
        baseCollection.add({ i: 2 });

        events.length = 0;
        i6.set({ a: 1 });

        var filteredPluck = filteredCollection.pluck('i');
        assert.deepEqual(filteredPluck, [10, 8, 6, 4, 2]);

        assert.deepEqual(events, [{
            "i": 6,
            "prevI": 6,
            "type": "change"
          }
        ]);

      });

      it('should not move models when the change does not affect the position of the model, at end', function() {
        baseCollection.add({ i: 6 });
        baseCollection.add({ i: 10 });
        baseCollection.add({ i: 8 });
        baseCollection.add({ i: 4 });
        var i2 = baseCollection.add({ i: 2 });

        events.length = 0;
        i2.set({ i: 0 });

        var filteredPluck = filteredCollection.pluck('i');
        assert.deepEqual(filteredPluck, [10, 8, 6, 4, 0]);

        assert.deepEqual(events, [{
            "i": 0,
            "prevI": 2,
            "type": "change"
          }
        ]);
      });

      it('should not move models when the change does not affect the position of the model, at start', function() {
        baseCollection.add({ i: 6 });
        var i10 = baseCollection.add({ i: 10 });
        baseCollection.add({ i: 8 });
        baseCollection.add({ i: 4 });
        baseCollection.add({ i: 2 });

        events.length = 0;
        i10.set({ i: 20 });

        var filteredPluck = filteredCollection.pluck('i');
        assert.deepEqual(filteredPluck, [20, 8, 6, 4, 2]);

        assert.deepEqual(events, [{
            "i": 20,
            "prevI": 10,
            "type": "change"
          }
        ]);

      });

      it('should not move models when the change does not affect the position of the model, in middle', function() {
        baseCollection.add({ i: 6 });
        baseCollection.add({ i: 20 });
        var i10 = baseCollection.add({ i: 10 });
        baseCollection.add({ i: 4 });
        baseCollection.add({ i: 2 });

        events.length = 0;
        i10.set({ i: 8 });

        var filteredPluck = filteredCollection.pluck('i');
        assert.deepEqual(filteredPluck, [20, 8, 6, 4, 2]);

        assert.deepEqual(events, [{
            "i": 8,
            "prevI": 10,
            "type": "change"
          }
        ]);

      });


    });

  });

});
