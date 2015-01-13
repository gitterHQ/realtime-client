# Gitter Realtime Client [![Build Status](https://travis-ci.org/gitterHQ/realtime-client.svg)](https://travis-ci.org/gitterHQ/realtime-client)

Live Backbone Collections of Gitter Data!

## Description

Gitter uses [Faye](http://faye.jcoglan.com) for it's realtime communications. It uses Faye as a fairly low-level messaging interface, and it can be quite difficult to implement an application correctly on top of it, especially when dealing idiosyncrasies in the protocol, like:

* Out of order messages
* Data-loss 
* Reinitialisation of state after client disconnections

**Gitter Realtime Client** provides a higher-level interface for building applications on top of the Gitter realtime API.

It uses Backbone Collections to represent Gitter data. The client will populate the collection and maintain the state of the collection to match the server-side representation of the state.

It's designed to work in Browser, Node and node-webkit environments.

## Warning

This library is very much a work in progress. The API is not yet stable. Feedback is very welcome!

## Usage

#### Step 1: Create a Realtime Client

You'll need a token, which you obtain using our OAuth API. See [developer.gitter.im](https://developer.gitter.im) for details.

```javascript
var realtimeClient = require('gitter-realtime-client');

var client = new realtimeClient.RealtimeClient({ token: process.env.GITTER_TOKEN });

```

#### Step 2: Create a Live Collection

Create a live Backbone collection, passing the client in via the options hash.

```javascript
var rooms = new realtimeClient.RoomCollection([], { client: client, listen: true });
```

#### Step 3: Use the Collection

You now have a standard Backbone collection. Use it with a Marionette `CollectionView` or however you wish to.


```javascript
rooms.on('change:unreadItems', function(model) {
  console.log(model.get('uri') + ' ' + model.get('unreadItems'))
});

// or

rooms.on('add remove reset change', function(model) {
  console.log(rooms.toJSON());
});
```

## License

The MIT License (MIT)

Copyright (c) 2015, Troupe Technology Limited

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
