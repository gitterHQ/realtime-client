"use strict";

var _ = require('underscore');
var Backbone = require('backbone');
var log = require('loglevel');
var backboneUrlResolver = require('backbone-url-resolver');

var PATCH_TIMEOUT = 2000; // 2000ms before a patch gives up

module.exports = Backbone.Collection.extend({
  modelName: '',
  constructor: function(models, options) {
    var defaults = { snapshot: true };
    options = _.extend(defaults, options);

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

    this.urlModel = this._getUrlModel();

    this._loading = false;

    this.once('sync', this._onInitialLoad, this);
    this.on('sync', this._onSync, this);
    this.on('request', this._onRequest, this);

    if(options && options.listen) {
      this.listen(options);
    }

  },

  addWaiter: function(id, callback, timeout) {
    log.info('coll: Waiting for id', id);

    if(!id) return;

    var self = this;
    var idAttribute = this.model.prototype.idAttribute || 'id';

    var actionPerformed = false;

    function done(model) {
      clearTimeout(timeoutRef);
      log.info('coll: Waitor completed with model', model);

      self.off('add', check, id);
      self.off('change:id', check, id);

      if(actionPerformed) {
        log.info('coll: Warning: waitor function called twice.');
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

  _onSync: function() {
    this._loading = false;
  },

  _onRequest: function() {
    this._loading = true;
  },

  _onInitialLoad: function() {
    if(this._initialLoadCalled) return;
    this._initialLoadCalled = true;

    this.trigger('loaded');
  },

  listen: function(/*options*/) {
    if (this._listening) return;
    this._listening = true;

    this._registerForSnapshots();

    var channel = this.urlModel.get('url');

    this.listenTo(this.urlModel, 'change:url', function(model, newChannel) {  // jshint unused:true
      if (newChannel) this._resubscribe(newChannel);
    });

    if (!channel) return;
    this._resubscribe(channel);
  },

  unlisten: function() {
    if (!this._listening) return;
    this._listening = false;

    // Stop listening to model changes....
    this.stopListening(this.urlModel);
    this._unsubscribe();
    this._deregisterForSnapshots();
  },

  _unsubscribe: function() {
    if(!this.subscription) return;
    this.subscription.cancel();
    this.subscription = null;
  },

  _registerForSnapshots: function() {
    if (this._snapshotsRegistered) return;
    this._snapshotsRegistered = true;
    // Subscribe to snapshots to the `null` channel so that we
    // can handle snapshots when the channel changes name
    this.client.registerSnapshotHandler(null, this);
  },

  _deregisterForSnapshots: function() {
    this.client.deregisterSnapshotHandler(null, this);
    this._snapshotsRegistered = false;
  },

  _resubscribe: function(channel) {
    this._unsubscribe();
    var self = this;
    this.subscription = this.client.subscribe(channel, function(message) {
      self._onDataChange(message);
    });

    this.subscription.errback(function(error) {
      log.error('coll: Subscription error for ' + channel, error);
    });
  },

  // Note that this may be overridden by child classes
  url: function() {
    if (!this.urlTemplate) throw new Error('Please provide either a url or urlTemplate');
    return this.urlModel.get('url');
  },

  _getUrlModel: function() {
    var url = _.result(this, 'urlTemplate') || _.result(this, 'channel') || _.result(this, 'url'); /* channel is deprecated */

    if (!url) throw new Error('channel is required');
    var contextModel = _.result(this, 'contextModel');

    if (!contextModel) {
      // Create a context model for backwards compatibility for clients
      // which have not supplied one
      var userId = this.userId || this.client.getUserId();
      contextModel = new Backbone.Model({ userId: userId });

      if (!userId) {
        this.listenToOnce(this.client, 'change:userId', function(userId) {
          contextModel.set({ userId: userId });
        });
      }
    }

    return backboneUrlResolver(url, contextModel);
  },

  getSnapshotStateForChannel: function(snapshotChannel) {
    // Since we subscribed to all snapshots, we need to ensure that
    // the snapshot is for this channel
    if (snapshotChannel !== this.urlModel.get('url')) return;
    if (this.getSnapshotState) return this.getSnapshotState();
  },

  handleSnapshot: function(snapshot, snapshotChannel) {
    // Since we subscribed to all snapshots, we need to ensure that
    // the snapshot is for this channel
    if (snapshotChannel !== this.urlModel.get('url')) return;

    this.trigger('request');
    // XXX: TODO: revist
    this.reset();
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
      /* Remove any presnapshot stuff (cached from previous time) */
      var forKeeping = this.where({ presnapshot: undefined });

      // add one by one
      this.set(forKeeping.concat(snapshot), options);
    } else {
      // trash it and add all in one go
      this.reset(snapshot, options);
    }

    this._onInitialLoad();
    this.trigger('sync');
    this.trigger('snapshot');
  },

  isLoading: function() {
    return this._loading;
  },

  hasLoaded: function() {
    return this._initialLoadCalled;
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
      log.info('coll: Performing ' + operation, newAttributes);
      if (!options) options = {};

      existingModel.set(parsed.attributes, options);
      existingModel.trigger('sync', existingModel, { live: options });
    } else {
      log.info('coll: Ignoring out-of-date update', existingModel.toJSON(), newAttributes);
    }
  },

  patch: function(id, newModel, options) {
    log.info('coll: Request to patch ' + id + ' with ', newModel, options);

    var self = this;

    if(this.transformModel) newModel = this.transformModel(newModel);
    var parsed = new this.model(newModel, { parse: true });
    var existing = this.findExistingModel(id, parsed);
    if(existing) {
      this.applyUpdate('patch', existing, newModel, parsed, options);
      return;
    }

    /* Existing model does not exist */
    this.addWaiter(id, function(existing) {
      if(!existing) {
        log.info('coll: Unable to find model ' + id);
        return;
      }

      self.applyUpdate('patch', existing, newModel, parsed, options);
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
                log.info('coll: Unable to find model ' + id);
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
        log.info("coll: Unknown operation " + operation + ", ignoring");

    }
  }
});
