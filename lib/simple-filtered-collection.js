'use strict';

var Backbone = require('backbone');

var SimpleFilteredCollection = Backbone.Collection.extend({
  constructor: function(models, options) {
    Backbone.Collection.call(this, models, options);

    if(!options || !options.collection) {
      throw new Error('A valid collection must be passed to a new instance of SimpleFilteredCollection');
    }

    this._collection = options.collection;
    this._filterFn = options.filter || this.filterFn;

    this.listenTo(this._collection, 'add', this._onAddEvent);
    this.listenTo(this._collection, 'remove', this._onRemoveEvent);
    this.listenTo(this._collection, 'reset', this._resetFromBase);
    this.listenTo(this._collection, 'change', this._onChangeEvent);

    this._resetFromBase();
  },

  /**
   * Default filter
   */
  filterFn: function() {
    return true;
  },

  _applyFilter: function() {
    // Start off by indexing whats already in the collection
    var newIndex = { };
    var filter = this._filterFn;

    var backingModels = this._collection.models;
    for(var i = 0; i < backingModels.length; i++) {
      var backingModel = backingModels[i];
      var matches = filter(backingModel);
      if (matches) {
        newIndex[backingModel.id || backingModel.cid] = backingModel;
      }
    }

    // Now, figure out what we need to add and remove
    var idsToRemove = [];
    var currentModels = this.models;
    for(var j = currentModels.length - 1; j >= 0; j--) {
      var currentModel = currentModels[j];
      var id = currentModel.id || currentModel.cid;

      if (newIndex.hasOwnProperty(id)) {
        // Was in the filtered collection and is still
        // in the collection
        delete newIndex[id];
      } else {
        idsToRemove.push(id);
      }
    }

    if (idsToRemove.length) {
      this.remove(idsToRemove);
    }

    // Add any new items that are left over
    var idsToAdd = Object.keys(newIndex);
    if (idsToAdd.length) {
      var modelsToAdd = Array(idsToAdd.length);
      for (var k = 0; k < idsToAdd.length; k++) {
        modelsToAdd[k] = newIndex[idsToAdd[k]];
      }

      // And a single add
      this.add(modelsToAdd);
    }

    this.trigger('filter-complete');
  },

  _onModelEvent: function(event, model, collection, options) {
    // Ignore change events from models that have recently been removed
    if (event === 'change' || event.indexOf('change:') === 0) {
      if (!this._filterFn(model)) return;
    }

    return Backbone.Collection.prototype._onModelEvent.call(this, event, model, collection, options);
  },

  _onAddEvent: function(model/*, collection, options*/) {
    if (this._filterFn(model)) {
      return this.add(model);
    }
  },

  _onRemoveEvent: function(model/*, collection, options*/) {
    return this.remove(model);
  },

  _resetFromBase: function() {
    var resetModels = this._collection.filter(this._filterFn);
    return this.reset(resetModels);
  },

  _onChangeEvent: function(model/*, options*/) {
    var cid = model.cid;
    var existsInCollection = this.get(cid);
    var matchesFilter = this._filterFn(model);
    if (matchesFilter && !existsInCollection) {
      this.add(model);
      return;
    }

    if (!matchesFilter && existsInCollection) {
      this.remove(model);
      return;
    }
  },

  setFilter: function(fn) {
    if (fn === this._filterFn) return;
    if (fn) this._filterFn = fn;
    this._applyFilter();
  }

});



module.exports = SimpleFilteredCollection;
