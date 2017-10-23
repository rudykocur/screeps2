var _ = require('lodash');

class CachedData {
    constructor(cache) {
        this.cache = cache;
    }

    _getOrSet(key, ttl, callback, serializer) {
        if(!this.cache[key] || this.cache[key].updateTime < Game.time) {
            this.cache[key] = {
                updateTime: Game.time,
                data: serializer(callback())
            }
        }
    }

    cachedObj(key, ttl, callback) {
        this._getOrSet(key, ttl, callback, obj => obj && obj.id);
        return Game.getObjectById(this.cache[key].data);
    }

    cachedObjCollection(key, ttl, callback) {
        this._getOrSet(key, ttl,callback, objs => objs.map(o => o.id));
        return _.map(this.cache[key].data, val => Game.getObjectById(val));
    }
}

module.exports = {
    CachedData
};