"use strict";

var Faye = require('gitter-faye');
var log = require('loglevel');
var _ = require('underscore');
var Backbone = require('backbone');

/* @const */
var FAYE_PREFIX = '/api';
var DEFAULT_FAYE_URL = 'https://ws.gitter.im/faye';

Faye.logger = {};
var logLevels = ['fatal', 'error', 'warn', 'info', 'debug'];

/* TODO: Add an option to add faye debug logging */
logLevels.forEach(function(level) {
  var llevel = level == 'fatal' ? 'error' : level;
  Faye.logger[level] = log[llevel].bind(log);
});

var ErrorLogger = function() {};
ErrorLogger.prototype.incoming = function(message, callback) {
  if(message.error) {
    log.error('rtc: Bayeux error', message);
  }

  callback(message);
};

var ClientAuth = function(client, options) {
  this.client = client;
  if(options.authProvider) {
    this.authProvider = options.authProvider;
  } else {
    this.authProvider = function(callback) {
      return callback({ token: options.token });
    };
  }
};

ClientAuth.prototype.outgoing = function(message, callback) {
  if(message.channel !== '/meta/handshake') return callback(message);

  this.client.clientId = null;
  log.info("rtc: Rehandshaking realtime connection");

  this.authProvider(function(authInfo) {
      if(!message.ext) message.ext = {};
      _.extend(message.ext, authInfo);
      callback(message);
   });
};


ClientAuth.prototype.incoming = function(message, callback) {
  if(message.channel !== '/meta/handshake') return callback(message);

  if(message.successful) {
    // New clientId?
    if(this.client.clientId !== message.clientId) {
      this.client.clientId = message.clientId;
      log.info("rtc: Realtime reestablished. New id is " + this.client.clientId);
      this.client.trigger('newConnectionEstablished');
    }

    if (message.ext && message.ext.context) {
      if (message.ext.context.user) {
        this.client.user.set(message.ext.context.user);
      } else if(message.ext.context.userId) {
        this.client.user.set({ id: message.ext.context.userId });
      }
    }

    // Clear any transport problem indicators
    this.client._transportUp();
  }

  callback(message);
};

var SequenceGapDetectorExtension = function(client) {
  var self = this;
  this.client = client;
  this._seq = 0;

  client.on('newConnectionEstablished', function() {
    self._seq = 0;
  });
};

SequenceGapDetectorExtension.prototype = {
  incoming: function(message, callback) {
    var c = message.ext && message.ext.c;
    var channel = message.channel;
    if(c && channel && channel.indexOf('/meta') !== 0) {
      if (c === 1) {
        this._seq = 1;
        this._seqStarted = true;
        return;
      }

      if (!this._seqStarted) return;

      var current = this._seq;
      this._seq = c;

      if (c !== current + 1) {
        // Stop listening to sequence messages until we get a `1` again...
        delete this._seqStarted;

        // Reset the connection
        log.warn('rtc: Message on channel ' + channel + ' out of sequence. Expected ' + (current + 1) + ' got ' + c + '. Resetting ' + this.client.clientId);
        this.client.trigger('sequence.error');
        this.client.reset(this.client.clientId);
      }

    }
    callback(message);
  }
};

var SnapshotExtension = function(client) {
  this.client = client;
  this._listeners = {};
  this._stateProvider = {};
  this._subscribeTimers = {};
};

SnapshotExtension.prototype = {
  outgoing: function(message, callback) {
    if (message.channel !== '/meta/subscribe') return callback(message);

    this._subscribeTimers[message.subscription] = Date.now(); // Record start time

    var ext = message.ext;
    if (!ext) {
      message.ext = ext = {};
    }

    var listeners = this._listeners[message.subscription];
    var snapshotState;
    if (listeners) {
        listeners.forEach(function(listener) {
          if(listener.getSnapshotState) {
            var state = listener.getSnapshotState();
            snapshotState = _.extend(state, snapshotState);
          }
        });
    }
    ext.snapshot = snapshotState;

    // TODO: move this into the handler
    var options = this.client.getSubscribeOptions(message.subscription);
    if (options) {
      Object.keys(options).forEach(function(key) {
        ext[key] = options[key];
      });
    }

    callback(message);
  },

  incoming: function(message, callback) {
    if (message.channel !== '/meta/subscribe' || !message.ext || !message.ext.snapshot) return callback(message);

    // Add some statistics into the mix
    var startTime = this._subscribeTimers[message.subscription];
    if (startTime) {
      delete this._subscribeTimers[message.subscription];
      var totalTime = Date.now() - startTime;

      if (totalTime > 400) {
        var lastPart = message.subscription.split(/\//).pop();
        this.client.trigger('stats', 'time', 'faye.subscribe.time.' + lastPart, totalTime);

        log.info('rtc: Subscription to ' + message.subscription + ' took ' + totalTime + 'ms');
      }
    }

    var listeners = this._listeners[message.subscription];
    var snapshot = message.ext.snapshot;

    if (listeners) {
      listeners.forEach(function(listener) {
        if(listener.handleSnapshot) {
          listener.handleSnapshot(snapshot);
        }
      });
    }


    callback(message);
  },

  registerSnapshotHandler: function(channel, snapshotHandler) {
    var list = this._listeners[channel];
    if (list) {
      list.push(snapshotHandler);
    } else {
      list = [snapshotHandler];
      this._listeners[channel] = list;
    }
  }
};

function RealtimeClient(options) {
  var self = this;
  this.user = new Backbone.Model();
  var client = new Faye.Client(options.fayeUrl || DEFAULT_FAYE_URL, options.fayeOptions);

  if (options.websocketsDisabled) {
    /* Testing no websockets */
    client.disable('websocket');
  }

  client.addExtension(new ClientAuth(this, options));
  client.addExtension(new SequenceGapDetectorExtension(this));
  client.addExtension(new ErrorLogger(this));

  this.snapshots = new SnapshotExtension(this);
  client.addExtension(this.snapshots);

  if(options.extensions) {
    options.extensions.forEach(function(extension) {
      client.addExtension(extension);
    });
  }

  // Connect early in order to obtain the userId
  client.connect();

  this.listenTo(this.user, 'change:id', function() {
    this.trigger('change:userId', this.user.id);
  });

  // Initially, the transport is down
  this._transportDown(10 /* seconds */);

  client.on('transport:down', function() {
    log.info('rtc: transport down');
    self._transportDown();
  });

  client.on('transport:up', function() {
    log.info('rtc: transport up');
    self._transportUp();
  });

  this.client = client;
}

_.extend(RealtimeClient.prototype, Backbone.Events, {

  reset: function(clientIdOnPing) {
    this.trigger('stats', 'event', 'faye.ping.reset');
    if(clientIdOnPing === this.clientId) {
      log.info("rtc: Client reset requested");
      this.clientId = null;
      this.client.reset();
    } else {
      log.info("rtc: Ignoring reset request as clientId has changed.");
    }
  },

  subscribe: function(channel, callback, context, options) {
    channel = FAYE_PREFIX + channel;
    log.info('rtc: Subscribing to ' + channel);

    // Temporary options to pass onto the subscription message
    if (!this.subscribeOptions) this.subscribeOptions = {};
    this.subscribeOptions[channel] = options;

    return this.client.subscribe(channel, callback, context);
  },

  disconnect: function () {
    this.client.disconnect();
  },

  registerSnapshotHandler: function(channel, snapshotHandler) {
    channel = FAYE_PREFIX + channel;

    return this.snapshots.registerSnapshotHandler(channel, snapshotHandler);
  },

  testConnection: function(reason) {
    var self = this;
    /* Wait until the connection is established before attempting the test */
    if(!this.clientId) return;

    if(this._pingOutstanding) return;

    if(reason !== 'ping') {
      this.trigger('testConnection', reason);
      log.info('rtc: Testing connection due to ' + reason);
    }

    this._pingOutstanding = true;

    var originalClientId = this.clientId;

    /* Only hold back pings for 30s, then retry is neccessary */
    setTimeout(function() {
      if(self._pingOutstanding) {
        delete self._pingOutstanding;
        self.reset(originalClientId);
      }
    }, 30000);

    this.client.publish(FAYE_PREFIX + '/v1/ping2', { reason: reason })
      .then(function() {
        delete self._pingOutstanding;
        log.info('rtc: Server ping succeeded');
      }, function(error) {
        delete self._pingOutstanding;

        log.warn('rtc: Server ping failed: ', error);
        self.reset(originalClientId);
      });
  },

  getClientId: function() {
    return this.clientId;
  },

  getUserId: function() {
    return this.user.id;
  },

  getSubscribeOptions: function(channel) {
    if(!this.subscribeOptions) return;

    var options = this.subscribeOptions[channel];
    delete this.subscribeOptions[channel];
    return options;
  },

  _transportDown: function(persistentOutageTimeout) {
    var self = this;
    var timeout = persistentOutageTimeout || 60;

    if(!this._connectionFailureTimeout) {
      this._connectionFailureTimeout = setTimeout(function() {
        if(!self._persistentOutage) {
          self._persistentOutageStartTime = Date.now();
          self._persistentOutage = true;
          log.info('rtc: persistent outage');
          self.trigger('connectionFailure');
        }
      }, timeout * 1000);
    }
  },

  _transportUp: function () {
    if(this._connectionFailureTimeout) {
      clearTimeout(this._connectionFailureTimeout);
      this._connectionFailureTimeout = null;
    }

    if(this._persistentOutage) {
      this.trigger('stats', 'event', 'faye.outage.restored');
      this.trigger('stats', 'time', 'faye.outage.restored.time', Date.now() - this._persistentOutageStartTime);
      delete this._persistentOutage;
      delete this._persistentOutageStartTime;

      log.info('rtc: persistent outage restored');
      this.trigger('connectionRestored');
    }
  }
});

module.exports = RealtimeClient;
