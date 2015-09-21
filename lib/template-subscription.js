'use strict';

var backboneUrlResolver = require('backbone-url-resolver');
var log                 = require('loglevel');
var _                   = require('underscore');
var Backbone            = require('backbone');
var defaultContextModel = require('./default-context-model');

function TemplateSubscription(client, options) {
  this.options = options;
  this.client = client;

  if (!options.onMessage) throw new Error('onMessage is required');

  if (options.urlModel) {
    this.urlModel = options.urlModel;
  } else {
    this.urlModel = this._getUrlModel(options);
  }

  this._subscribe();
}

_.extend(TemplateSubscription.prototype, Backbone.Events, {
  _subscribe: function(/*options*/) {
    if (this._subscribed) return;
    this._subscribed = true;

    this._registerForSnapshots();

    var url = this.url();

    this.listenTo(this.urlModel, 'change:url', function(model, newChannel) {  // jshint unused:true
      if (newChannel) {
        this._resubscribe(newChannel);
      } else {
        this._unsubscribe();
      }
    });

    if (!url) return;
    this._resubscribe(url);
  },

  cancel: function() {
    if (!this._subscribed) return;
    this._subscribed = false;

    // Stop listening to model changes....
    this.stopListening(this.contextModel);
    this._unsubscribe();
    this._deregisterForSnapshots();
  },

  _unsubscribe: function() {
    if(!this.subscription) return;
    this.trigger('unsubscribe');
    this.subscription.cancel();
    this.subscription = null;
  },

  _registerForSnapshots: function() {
    if (this._snapshotsRegistered) return;
    // Do we need snapshots?
    var options = this.options;
    if (!options.getSnapshotState && !options.handleSnapshot && !options.getSubscribeOptions) return;
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

    this.trigger('resubscribe', channel);
    var self = this;
    this.subscription = this.client.subscribe(channel, this.options.onMessage);

    this.subscription.errback(function(error) {
      log.error('coll: Subscription error for ' + channel, error);
      self.emit('subscriptionError', channel, error);
      self.subscription = null;
    });
  },

  // Note that this may be overridden by child classes
  url: function() {
    return this.urlModel.get('url');
  },

  _getUrlModel: function(options) {
    var url = _.result(options, 'urlTemplate');
    var contextModel = _.result(options, 'contextModel');

    if (!contextModel) {
      contextModel = defaultContextModel(this.client);
    }

    return backboneUrlResolver(url, contextModel);
  },

  getSnapshotStateForChannel: function(snapshotChannel) {
    // Since we subscribed to all snapshots, we need to ensure that
    // the snapshot is for this channel
    if (snapshotChannel !== this.urlModel.get('url')) return;

    if (this.options.getSnapshotState) {
      return this.options.getSnapshotState(snapshotChannel);
    }
  },

  getSubscribeOptions: function(snapshotChannel) {
    if (snapshotChannel !== this.urlModel.get('url')) return;

    if (this.options.getSubscribeOptions) {
      return this.options.getSubscribeOptions(snapshotChannel);
    }
  },

  handleSnapshot: function(snapshot, snapshotChannel) {
    // Since we subscribed to all snapshots, we need to ensure that
    // the snapshot is for this channel
    if (snapshotChannel !== this.urlModel.get('url')) return;

    if (this.options.handleSnapshot) {
      return this.options.handleSnapshot(snapshot, snapshotChannel);
    }
  }
});

module.exports = TemplateSubscription;
