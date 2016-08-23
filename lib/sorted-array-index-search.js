'use strict';

function sortedArrayIndexSearch(array, comparator, value) {
  var low = 0, high = array.length
  while (low < high) {
    var mid = Math.floor((low + high) / 2);
    var current = array[mid];

    if (comparator(current, value) < 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

module.exports = sortedArrayIndexSearch;
