'use strict';

/* Inspired by https://github.com/hernantz/backbone.sos */
var LOADING_EVENTS = 'request';
var LOADED_EVENTS = 'sync error reset';

function loadingChange(obj, newState) {
  newState = !!newState;
  var current = !!obj.loading;
  obj.loading = newState;
  if (newState !== current) {
    obj.trigger(newState ? "loading" : "loaded", obj);
    obj.trigger('loading:change', obj, newState);
  }
}

function onLoading() {
  loadingChange(this, true);
}

function onLoaded() {
  loadingChange(this, false);
}

module.exports = {
  track: function(model) {
    model.loading = false;
    model.stateTracking = true;
    model.listenTo(model, LOADING_EVENTS, onLoading);
    model.listenTo(model, LOADED_EVENTS, onLoaded);
  },
  untrack: function(model) {
    model.stateTracking = false;
    model.stopListening(model, LOADING_EVENTS, onLoading);
    model.stopListening(model, LOADED_EVENTS, onLoaded);
  }
};
