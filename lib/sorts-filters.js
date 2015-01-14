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

function favouritesSort(a, b) {
  var isDifferent = natural(a.favourite, b.favourite);

  if (isDifferent) return isDifferent; // -1 or 1

  // both favourites of the same rank, order by name
  return natural(a.name, b.name);
}

function favouritesFilter(room) {
  return !!room.favourite;
}

function recentsSort(a, b) {
  var aRank = getRank(a);
  var bRank = getRank(b);

  if (aRank === bRank) {
    return timeDifference(a, b, aRank);
  } else {
    return aRank - bRank;
  }
}

function recentsFilter(room) {
  return !room.favourite && !!(room.lastAccessTime || room.unreadItems || room.mentions);
}

function unreadsFilter(room) {
  return !!room.unreadItems;
}

function unreadsSort(model) {
  return model.lastAccessTime;
}


// we want to sort in a descending order, thus the negative results
module.exports = {
  pojo: {
    favourites: {
      sort: favouritesSort,
      filter: favouritesFilter
    },
    recents: {
      sort: recentsSort,
      filter: recentsFilter
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
