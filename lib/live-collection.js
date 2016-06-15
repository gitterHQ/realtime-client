"use strict";

var Halley                = require('halley/backbone');
var Promise               = Halley.Promise;
var _                     = require('underscore');
var Backbone              = require('backbone');
var backboneUrlResolver   = require('backbone-url-resolver');
var defaultContextModel   = require('./default-context-model');
var debug                 = require('debug-proxy')('grc:live-collection');
var backboneStateTracking = require('./backbone-state-tracking');

var PATCH_TIMEOUT = 2000; // 2000ms before a patch gives up

function getOptionOrProperty(object, options, name) {
  if (options[name]) return _.result(options, name);
  return _.result(object, name);
}

module.exports = Backbone.Collection.extend({
  modelName: '',
  /**
   * Indicates that when a subscribe occurs, the server
   * will return a snapshot. Defaults to true, but can
   * also be a function returning true or false.
   * TODO: allow this to be passed in `options`
   */
  subscribeReturnsSnapshot: true,
  constructor: function(models, options) {
    var defaults = { snapshot: true };
    options = _.extend(defaults, options);

    // indicates if this LiveCollection has received at least one snapshot ever
    this._snapshotReceived = false;

    if (options.client) {
      this.client = options.client;
    } else {
      this.client = _.result(this, 'client', null);
    }

    if (!this.client) {
      throw new Error('LiveCollection requires a client to be passed in via options or via client property');
    }

    // Call super constructor
    Backbone.Collection.prototype.constructor.call(this, models, options);

    // Setup the context-model
    var contextModel = getOptionOrProperty(this, options, 'contextModel');
    if (!contextModel) {
      contextModel = defaultContextModel(this.client, this.userId);
    }
    this.contextModel = contextModel;

    this.urlModel = this._getUrlModel(options);
    backboneStateTracking.track(this);

    if(options && options.listen) {
      this.listen();
    }

  },

  addWaiter: function(id, callback, timeout) {
    debug('Waiting for id %s in collection', id);

    if(!id) return;

    var self = this;
    var idAttribute = this.model.prototype.idAttribute || 'id';

    var actionPerformed = false;

    function done(model) {
      clearTimeout(timeoutRef);

      self.off('add', check, id);
      self.off('change:id', check, id);

      /* This check is probably not strictly neccessary */
      if(actionPerformed) {
        debug('Warning: waiter function called twice.');
        return;
      }
      actionPerformed = true;

      if(model) {
        callback.apply(self, [model]);
      } else {
        callback.apply(self, []);
      }
    }

    function check(model) {
      if(model && model[idAttribute] === id) {
        done(model);
      }
    }

    var timeoutRef = setTimeout(function() {
      done();
    }, timeout);

    this.on('add', check, id);
    this.on('change:id', check, id);
  },

  listen: function() {
    if (this.templateSubscription) throw new Error('Already subscribed');

    this.templateSubscription = this.client.subscribeTemplate({
      urlModel: this.urlModel,
      onMessage: this._onDataChange.bind(this),
      getSnapshotState: this.getSnapshotState && this.getSnapshotState.bind(this),
      handleSnapshot: this.handleSnapshot.bind(this)
    });

    this.listenTo(this.templateSubscription, 'resubscribe', function() {
      debug('Resetting collection on resubscribe: %s', this.url());
      this._resetOptional();

      var subscribeReturnsSnapshot =  _.result(this, 'subscribeReturnsSnapshot');
      if (subscribeReturnsSnapshot) {
        // Triggering a "request" will let listeners know that
        // data is being loaded and the collection is in a
        // loading state
        this.trigger('request');
      }
    });

    this.listenTo(this.templateSubscription, 'unsubscribe', function() {
      debug('Resetting collection on unsubscribe: %s', this.url());
      this._resetOptional();
    });

    this.listenTo(this.templateSubscription, 'subscriptionError', function(channel, error) {
      this.trigger('error', this, error, { reason: 'subscription_failed', channel: channel });
    });

  },

  unlisten: function() {
    if (!this.templateSubscription) return;
    this.templateSubscription.cancel();
    this.stopListening(this.templateSubscription);
    this.templateSubscription = null;
  },

  // Note that this may be overridden by child classes
  url: function() {
    if (!this.urlTemplate) throw new Error('Please provide either a url or urlTemplate');
    return this.urlModel.get('url');
  },

  _getUrlModel: function(options) {
    var url = getOptionOrProperty(this, options, 'urlTemplate') ||
                getOptionOrProperty(this, options, 'channel') ||  /* channel is deprecated */
                getOptionOrProperty(this, options, 'url');

    if (!url) throw new Error('channel is required');

    return backboneUrlResolver(url, this.contextModel);
  },

  _resetOptional: function() {
    this._snapshotReceived = false;

    if (!this.length) return;

    // Performance tweak
    // Don't re-issue resets on empty collections
    // as this may cause a whole lot of unneccassary
    // dom manipulation
    this.reset();
  },

  handleSnapshot: function(snapshot) {
    /**
     * Don't remove items from the collections, as there is a greater
     * chance that they've been added on the client than that they've
     * been removed from the server. One day we may want to handle the
     * case that the server object has been removed, but it's not that
     * likely and doesn't warrant the extra complexity
     */
    var options = {
      parse: true,    /* parse the items */
      remove: true,
      add: true,      /* add new items */
      merge: true     /* merge into items that already exist */
    };

    if(this.length > 0) {
      debug('Performing merge on snapshot (current length is %s)', this.length);
      this.set(snapshot, options);
    } else {
      debug('Performing reset on snapshot');
      // trash it and add all in one go
      this.reset(snapshot, options);
    }

    this._snapshotReceived = true;

    this.trigger('sync');
    this.trigger('snapshot');
  },

  onSnapshotReceived: function() {
    var self = this;
    if (this._snapshotReceived) {
      debug('Snapshot already received, resolving immediately');
      return Promise.resolve();
    } else {
      debug('Awaiting snapshot');
      return new Promise(function(resolve, reject) {
        self.once('snapshot', function() {
          var resolved = true;
          debug('Snapshot received');
          resolve();
        });
        self.once('subscriptionError', function() {
          debug('Error received before promise could get resolved.');
          reject();
        });
      });
    }
  },

  findExistingModel: function(id, newModel) {
    var existing = this.get(id);
    if(existing) return existing;

    if(this.findModelForOptimisticMerge) {
      existing = this.findModelForOptimisticMerge(newModel);
    }

    return existing;
  },

  operationIsUpToDate: function(operation, existing, newModel) {
    var existingVersion = existing.get('v') ? existing.get('v') : 0;
    var incomingVersion = newModel.v ? newModel.v : 0;

    // Create operations are always allowed
    if(operation === 'create') return true;

    // Existing version is unversioned? Allow
    if(!existingVersion) return true;

    // New operation is unversioned? Dodgy. Only allow if the operation is a patch
    if(!incomingVersion) return operation === 'patch';

    if(operation === 'patch') {
      return incomingVersion >= existingVersion;
    }

    return incomingVersion > existingVersion;
  },

  // TODO: make this dude tighter
  applyUpdate: function(operation, existingModel, newAttributes, parsed, options) {
    if(this.operationIsUpToDate(operation, existingModel, newAttributes)) {
      debug('Performing %s: %j', operation, newAttributes);
      if (!options) options = {};

      existingModel.set(parsed.attributes, options);
      existingModel.trigger('sync', existingModel, { live: options });
    } else {
      debug('Ignoring out-of-date update. existing=%j, new=%j', existingModel.attributes, newAttributes);
    }
  },

  /**
   * Patch an existing model.
   * If the model does not exist, will wait for a small period (`PATCH_TIMEOUT`)
   * in case the live collection has not yet updated.
   *
   * The optional callback has two parameters [id, found]
   * * `id` is the id of the model passed into the call
   * * `found` is true if the model was found in the collection
   */
  patch: function(id, newModel, options, callback) {
    debug('Request to patch %s with %j', id, newModel);

    var self = this;

    if(this.transformModel) newModel = this.transformModel(newModel);
    var parsed = new this.model(newModel, { parse: true });
    var existing = this.findExistingModel(id, parsed);
    if(existing) {
      this.applyUpdate('patch', existing, newModel, parsed, options);
      if (callback) callback(id, true);
      return;
    }

    /* Existing model does not exist */
    this.addWaiter(id, function(existing) {
      if(!existing) {
        debug('Unable to find model %s', id);
        if (callback) callback(id, false);
        return;
      }

      self.applyUpdate('patch', existing, newModel, parsed, options);
      if (callback) callback(id, true);
    }, PATCH_TIMEOUT);
  },

  _onDataChange: function(data) {
    var self = this;
    var operation = data.operation;
    var newModel = data.model;
    var idAttribute = this.model.prototype.idAttribute || 'id';
    var id = newModel[idAttribute];

    if(this.ignoreDataChange) {
      if(this.ignoreDataChange(data)) return;
    }

    if(this.transformModel) newModel = this.transformModel(newModel);
    var parsed = new this.model(newModel, { parse: true });
    var existing = this.findExistingModel(id, parsed);

    switch(operation) {
      case 'create':
      case 'patch':
      case 'update':
        // There can be existing documents for create events if the doc was created on this
        // client and lazy-inserted into the collection
        if(existing) {
          this.applyUpdate(operation, existing, newModel, parsed);
          break;
        } else {
          /* Can't find an existing model */
          if(operation === 'patch') {
            this.addWaiter(id, function(existing) {
              if(!existing) {
                debug('Unable to find model id=%s', id);
                return;
              }

              self.applyUpdate('patch', existing, newModel, parsed);
            }, PATCH_TIMEOUT);

          } else {
            this.add(parsed);
          }
        }

        break;

      case 'remove':
        if(existing) {
          this.remove(existing);
        }

        break;

      default:
        debug("Unknown operation %s, ignoring", operation);

    }
  }
});
