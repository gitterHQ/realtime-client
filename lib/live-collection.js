"use strict";

var _ = require('underscore');
var Backbone = require('backbone');
var log = require('loglevel');

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

    Backbone.Collection.prototype.constructor.call(this, models, options);

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

  listen: function(options) {
    if(this.subscription) return;
    var self = this;

    this.resolveChannel(function(channel) {

      self.subscription = self.client.subscribe(channel, function(message) {
        self._onDataChange(message);
      });

      if (options && options.snapshot) {
        self.client.registerSnapshotHandler(channel, self);
      }

      self.subscription.errback(function(error) {
        log.error('coll: Subscription error for ' + channel, error);
      });

    });

  },

  resolveChannel: function(callback) {
    // this.url or this.url()
    var channel = _.result(this, 'channel');
    if (!channel) throw new Error('channel is required');

    /* Very basic implementation for now */
    if (!/:userId/.test(channel)) return callback(channel);

    var userId = this.userId || this.client.getUserId();

    if (userId) return callback(channel.replace(/:userId/g, userId));

    this.listenToOnce(this.client, 'change:userId', function(userId) {
      return callback(channel.replace(/:userId/g, userId));
    });

  },

  handleSnapshot: function(snapshot) {
    this.trigger('request');

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
      this.set(snapshot.concat(forKeeping), options);
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

  unlisten: function() {
    if(!this.subscription) return;
    this.subscription.cancel();
    this.subscription = null;
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

      existingModel.set(parsed.attributes, options || {});
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
