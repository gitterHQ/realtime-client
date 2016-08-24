'use strict';

var sortsFilters = require('./sorts-filters');
var SimpleFilteredCollection = require('./simple-filtered-collection');

function apply(collection, filter, sort) {
  return new SimpleFilteredCollection([], {
    model: collection.model,
    collection: collection,
    comparator: sort,
    filter: filter,
    autoResort: true
  });
}

module.exports = {
  favourites: function(collection) {
    return apply(collection, sortsFilters.model.favourites.filter, sortsFilters.model.favourites.sort);
  },
  recents: function(collection) {
    return apply(collection, sortsFilters.model.recents.filter, sortsFilters.model.recents.sort);
  },
  unreads: function(collection) {
    return apply(collection, sortsFilters.model.unreads.filter, sortsFilters.model.unreads.sort);
  }
};
