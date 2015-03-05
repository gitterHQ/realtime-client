'use strict';

function modelAdapter(fn) {
  return function(a, b) {
    return fn(a && a.attributes, b && b.attributes);
  };
}

function natural(a, b) {
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

/* Always sorts nulls after non-nulls */
function nullsLast(fn) {
  return function(a, b) {
    if (a && !b) return 1;
    if (b && !a) return -1;
    if (!a && !b) return 0;
    return fn(a, b);
  };
}

/* Always filter nulls */
function filterNulls(fn) {
  return function(a) {
    if (!a) return false;
    return fn(a);
  };
}

function getRank(room) {
  // hasHadMentionsAtSomePoint (and the equivalent for unreadItems) is used
  // to ensure that rooms dont jump around when mentions is updated after a
  // user visits a room and reads all the mentions.
  // hasHadMentionsAtSomePoint is not available on the server, so we have a failover.
  if (room.hasHadMentionsAtSomePoint || room.mentions) {
    return 0;
  } else if (room.hasHadUnreadItemsAtSomePoint || room.unreadItems) {
    return 1;
  } else {
    return 2;
  }
}

function timeDifference(a, b) {
  // lastAccessTimeNoSync is used to ensure that rooms dont jump around when
  // lastAccessTime is updated after a user visits a room
  // lastAccessTimeNoSync is not available on the server, so we have a failover.
  var aDate = a.lastAccessTimeNoSync || a.lastAccessTime;
  var bDate = b.lastAccessTimeNoSync || b.lastAccessTime;

  if(!aDate && !bDate) {
    return 0;
  } else if(!aDate) {
    // therefore bDate exists and is best
    return 1;
  } else if(!bDate) {
    // therefore aDate exists and is best
    return -1;
  } else {
    return new Date(bDate).valueOf() - new Date(aDate).valueOf();
  }
}

var favouritesSort = nullsLast(function(a, b) {
  var isDifferent = natural(a.favourite, b.favourite);

  if (isDifferent) return isDifferent; // -1 or 1

  // both favourites of the same rank, order by name
  return natural(a.name, b.name);
});

var favouritesFilter = filterNulls(function(room) {
  return !!room.favourite;
});

var recentsSort = nullsLast(function(a, b) {
  var aRank = getRank(a);
  var bRank = getRank(b);

  if (aRank === bRank) {
    return timeDifference(a, b, aRank);
  } else {
    return aRank - bRank;
  }
});

var recentsFilter = filterNulls(function(room) {
  return !room.favourite && !!(room.lastAccessTime || room.unreadItems || room.mentions);
});

var unreadsSort = nullsLast(function (model) {
  return model.lastAccessTime;
});

var unreadsFilter = filterNulls(function(room) {
  return !!room.unreadItems;
});


// we want to sort in a descending order, thus the negative results
module.exports = {
  pojo: {
    favourites: {
      sort: nullsLast(favouritesSort),
      filter: favouritesFilter
    },
    recents: {
      sort: nullsLast(recentsSort),
      filter: recentsFilter
    },
    unreads: {
      sort: unreadsSort,
      filter: unreadsFilter
    }
  },
  model: {
    favourites: {
      sort: modelAdapter(favouritesSort),
      filter: modelAdapter(favouritesFilter)
    },
    recents: {
      sort: modelAdapter(recentsSort),
      filter: modelAdapter(recentsFilter)
    },
    unreads: {
      sort: modelAdapter(unreadsSort),
      filter: modelAdapter(unreadsFilter)
    }
  }
};
