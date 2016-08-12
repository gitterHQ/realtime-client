'use strict';

var Backbone = require('backbone');
var _ = require('underscore');

var LimitedCollection = Backbone.Collection.extend({
  constructor: function(models, options) {
    if(!options || !options.collection) {
      throw new Error('A valid collection must be passed to a new instance of LimitedCollection');
    }

    this._collection = options.collection;
    this._maxLength = options.maxLength || 10;

    var resetModels = this._collection.slice(0, this._maxLength);

    Backbone.Collection.call(this, resetModels, _.extend({ }, options, {
      comparator: this._collection.comparator
    }));

    this.listenTo(this._collection, 'add', this._onAddEvent);
    this.listenTo(this._collection, 'remove', this._onRemoveEvent);
    this.listenTo(this._collection, 'reset', this._resetFromBase);
    this.listenTo(this._collection, 'sort', this._resetFromSort);
  },

  _onAddEvent: function(model /*, collection, options*/) {
    var index = this._collection.indexOf(model);
    if (index >= this._maxLength) {
      return;
    }

    return this.add(model);
  },

  _onRemoveEvent: function(model/*, collection, options*/) {
    var didRemove = this.remove(model);
    if (didRemove) {
      this._resetFromSort();
    }
  },

  _resetFromBase: function() {
    var resetModels = this._collection.slice(0, this._maxLength);
    this.comparator = this._collection.comparator;

    return this.reset(resetModels);
  },

  _resetFromSort: function() {
    var resetModels = this._collection.slice(0, this._maxLength);
    this.comparator = this._collection.comparator;
    this.set(resetModels, {
      add: true,
      remote: true,
      merge: false
    })
  }
});



module.exports = LimitedCollection;
