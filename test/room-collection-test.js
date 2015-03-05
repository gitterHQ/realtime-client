'use strict';

var realtimeClient = require('..');
require('loglevel').setLevel('debug');

var blocked = require('blocked');
blocked(function(ms){
  if (ms > 0) {
    console.log('BLOCKED FOR %sms', ms);
  }
});

var client = new realtimeClient.RealtimeClient({
  // fayeUrl: 'https://ws-beta.gitter.im/faye',
  token: process.env.GITTER_TOKEN,
  fayeOptions: {

  }
 });

var rooms = new realtimeClient.RoomCollection([], { client: client, listen: true });

var favs = realtimeClient.filteredRooms.favourites(rooms);

/* Display all the favs, all the time */
favs.on('add remove reset change', function() {
  // console.log(favs.toJSON());
  console.log('change');
});

rooms.on('change:unreadItems', function(model) {
  // console.log(model.get('uri') + ' ' + model.get('unreadItems'))
  console.log('unread');
});
