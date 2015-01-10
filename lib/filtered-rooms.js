'use strict';

var FilteredCollection = require('../vendor/filtered-collection');
var SortedCollection = require('backbone-sorted-collection');
var sortsFilters = require('./sorts-filters');

function apply(collection, filter, sort) {
  var c = new FilteredCollection(null, { model: collection.model, collection: collection });
  c.setFilter(filter);
  var sorted = new SortedCollection(c);
  sorted.setSort(sort);

  return sorted;
}

module.exports = {
  favourites: function(collection) {
    return apply(collection, sortsFilters.model.favourites.filter, sortsFilters.model.favourites.sort);
  },
  recents: function(collection) {
    return apply(collection, sortsFilters.model.recent.filter, sortsFilters.model.recent.sort);
  }
};

