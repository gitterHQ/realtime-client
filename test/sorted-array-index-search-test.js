'use strict';

var assert = require('assert');
var sortedArrayIndexSearch = require('../lib/sorted-array-index-search');

var intComparator = function(a, b) {
  return a - b;
}
var xComparator = function(a, b) {
  return a.x - b.x;
}

describe('sorted-array-index-search', function() {

  it('should work with int arrays', function() {
    var array = [2, 3, 4, 5, 6, 7, 8];
    assert.strictEqual(sortedArrayIndexSearch(array, intComparator, 1), 0);
    assert.strictEqual(sortedArrayIndexSearch(array, intComparator, 2), 0);
    assert.strictEqual(sortedArrayIndexSearch(array, intComparator, 3), 1);
    assert.strictEqual(sortedArrayIndexSearch(array, intComparator, 8), 6);
    assert.strictEqual(sortedArrayIndexSearch(array, intComparator, 9), 7);
  });

  it('should work with object arrays', function() {
    var array = [2, 3, 4, 5, 6, 7, 8].map(function(x) {
      return { x: x };
    });

    assert.strictEqual(sortedArrayIndexSearch(array, xComparator, { x: 1 }), 0);
    assert.strictEqual(sortedArrayIndexSearch(array, xComparator, { x: 2 }), 0);
    assert.strictEqual(sortedArrayIndexSearch(array, xComparator, { x: 3 }), 1);
    assert.strictEqual(sortedArrayIndexSearch(array, xComparator, { x: 8 }), 6);
    assert.strictEqual(sortedArrayIndexSearch(array, xComparator, { x: 9 }), 7);
  });


})
