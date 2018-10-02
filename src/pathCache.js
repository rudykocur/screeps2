var _ = require('lodash');

const cache = require('utils.cache');

module.exports = {
    getPath: function(from, to) {
        return null;

        if(!('path' in Memory.cache)) {
            return null;
        }

        let cacheInst = new cache.CachedData(Memory.cache.path);

        let key = from.serialize()+'-'+to.serialize();

        return cacheInst.getCachedPositions(key);
    },

    /**
     * @param {RoomPosition} from
     * @param {RoomPosition} to
     * @param ttl
     * @param {Array<RoomPosition>} path
     */
    savePath: function(from, to, ttl, path) {
        return;

        if(path.length < 7) {
            return
        }

        if(!('path' in Memory.cache)) {
            Memory.cache.path = {};
        }

        let cacheInst = new cache.CachedData(Memory.cache.path);

        let key = from.serialize()+'-'+to.serialize();

        cacheInst.setCachedPositions(key, ttl, path);
    },

    cleanupCache: function() {
        return;

        if(!('path' in Memory.cache)) {
            return null;
        }

        let data = Memory.cache.path;

        let toDelete = [];

        _.each(data, (val, key) => {
            if(val.updateTime <= Game.time) {
                toDelete.append(key);
            }
        });

        if(toDelete.length > 0) {
            toDelete.forEach(key => {
                delete data[key];
            });
        }
    },
};