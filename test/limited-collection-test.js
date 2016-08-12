'use strict';

var assert = require('assert');
var Backbone = require('backbone');
var LimitedCollection = require('../lib/limited-collection');

describe('LimitedCollection', function() {

  var baseCollection;
  var limitedCollection;
  var events;

  beforeEach(function() {
    events = [];
    baseCollection = new Backbone.Collection([], {
      comparator: function(a, b) {
        return a.get('i') - b.get('i');
      }
    });

    limitedCollection = new LimitedCollection([], {
      collection: baseCollection,
      maxLength: 3
    });

    limitedCollection.on('add', function(model) {
      events.push({ type: 'add', i: model.get('i') });
    });

    limitedCollection.on('remove', function(model) {
      events.push({ type: 'remove', i: model.get('i') });
    });

    limitedCollection.on('reset', function() {
      events.push({ type: 'reset' });
    });

    limitedCollection.on('sort', function() {
      events.push({ type: 'sort' });
    });

    limitedCollection.on('change', function(model) {
      events.push({ type: 'change', i: model.get('i'), prevI: model.previous('i') });
    });

  });

  it('should handle an empty collection', function() {
    assert.strictEqual(limitedCollection.length, 0);
    assert.deepEqual(events, []);
  });

  it('should handle adds', function() {
    assert.strictEqual(limitedCollection.length, 0);

    baseCollection.add({ i: 0 });
    assert.strictEqual(limitedCollection.length, 1);
    assert.deepEqual(events, [
      { type: 'add', i: 0 },
      { type: 'sort' }
    ]);

    events = [];
    baseCollection.add({ i: 1 });
    assert.strictEqual(limitedCollection.length, 2);
    assert.deepEqual(events, [
      { type: 'add', i: 1 },
      { type: 'sort' }
    ]);

    events = [];
    baseCollection.add({ i: 2 });
    assert.strictEqual(limitedCollection.length, 3);
    assert.deepEqual(events, [
      { type: 'add', i: 2 },
      { type: 'sort' }
    ]);

    events = [];
    baseCollection.add({ i: 3 });
    assert.strictEqual(limitedCollection.length, 3);
    assert.deepEqual(events, []);


    var limitedPluck = limitedCollection.pluck('i');
    assert.deepEqual(limitedPluck, [0, 1, 2]);
  });

  it('should handle duplicate adds', function() {
    var a1 = baseCollection.add({ i: 0 });
    assert.strictEqual(limitedCollection.length, 1);
    assert.deepEqual(events, [
      { type: 'add', i: 0 },
      { type: 'sort' }
    ]);

    events = [];
    baseCollection.add(a1);
    assert.strictEqual(limitedCollection.length, 1);
    assert.deepEqual(events, []);

    var limitedPluck = limitedCollection.pluck('i');
    assert.deepEqual(limitedPluck, [0]);
  });

  it('should handle removes inside the limit with no more items', function() {
    baseCollection.add({ i: 0 });
    baseCollection.add({ i: 1 });
    var i2 = baseCollection.add({ i: 2 });

    assert.strictEqual(limitedCollection.length, 3);

    events = [];
    baseCollection.remove(i2);
    assert.strictEqual(limitedCollection.length, 2);
    assert.deepEqual(events, [
      { type: 'remove', i: 2 }
    ]);

    var limitedPluck = limitedCollection.pluck('i');
    assert.deepEqual(limitedPluck, [0, 1]);
  });

  it('should handle removes inside the limit when theres more items', function() {
    baseCollection.add({ i: 0 });
    baseCollection.add({ i: 1 });
    var i2 = baseCollection.add({ i: 2 });
    baseCollection.add({ i: 3 });

    assert.strictEqual(limitedCollection.length, 3);

    events = [];
    baseCollection.remove(i2);
    assert.strictEqual(limitedCollection.length, 3);
    assert.deepEqual(events, [
      { type: 'remove', i: 2 },
      { type: 'add', i: 3 },
      { type: 'sort' }
    ]);

    var limitedPluck = limitedCollection.pluck('i');
    assert.deepEqual(limitedPluck, [0, 1, 3]);
  });

  it('should handle removes outside the limit', function() {
    baseCollection.add({ i: 0 });
    baseCollection.add({ i: 1 });
    baseCollection.add({ i: 2 });
    var i3 = baseCollection.add({ i: 3 });

    assert.strictEqual(limitedCollection.length, 3);

    events = [];
    baseCollection.remove(i3);
    assert.strictEqual(limitedCollection.length, 3);
    assert.deepEqual(events, []);

    var limitedPluck = limitedCollection.pluck('i');
    assert.deepEqual(limitedPluck, [0, 1, 2]);
  });

  it('should handle resets', function() {
    baseCollection.add({ i: 0 });
    baseCollection.add({ i: 1 });
    baseCollection.add({ i: 2 });
    assert.strictEqual(limitedCollection.length, 3);

    events = [];
    baseCollection.reset();
    assert.strictEqual(limitedCollection.length, 0);
    assert.deepEqual(events, [{
      type: 'reset'
    }]);

    var limitedPluck = limitedCollection.pluck('i');
    assert.deepEqual(limitedPluck, []);
  });

  it('should handle populated resets', function() {
    baseCollection.add({ i: 0 });
    baseCollection.add({ i: 1 });
    baseCollection.add({ i: 2 });
    assert.strictEqual(limitedCollection.length, 3);

    events = [];
    baseCollection.reset([ { i: 3 }, { i: 4 }, { i: 1 }, { i: 5 }]);
    assert.strictEqual(limitedCollection.length, 3);
    assert.deepEqual(events, [{
      type: 'reset'
    }]);

    var limitedPluck = limitedCollection.pluck('i');
    assert.deepEqual(limitedPluck, [1, 3, 4]);
  });

});
