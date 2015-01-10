'use strict';

var realtimeClient = require('..');
// require('loglevel').setLevel('trace');

var client = new realtimeClient.RealtimeClient({ fayeUrl: 'https://ws-beta.gitter.im/faye', token: process.env.GITTER_TOKEN });
var rooms = new realtimeClient.RoomCollection([], { client: client, listen: true });

var favs = realtimeClient.filteredRooms.favourites(rooms);

favs.on('add remove reset change', function() {
  console.log(favs.toJSON());
});

rooms.on('change:unreadItems', function(model) {
  console.log(model.get('uri') + ' ' + model.get('unreadItems'))
});
