var _ = require('lodash');

const profiler = require('profiler');

class CachedData {
    constructor(cache) {
        this.cache = cache;
    }

    getData(callback, serializer) {
        return serializer(callback());
    }

    _getOrSet(key, ttl, callback, serializer) {
        if(!this.cache[key] || this.cache[key].updateTime <= Game.time) {
            this.cache[key] = {
                updateTime: Game.time + ttl,
                data: this.getData(callback, serializer)
            }
        }
    }

    cachedValue(key, ttl, callback) {
        this._getOrSet(key, ttl, callback, obj => obj);
        return this.cache[key].data;
    }

    cachedObj(key, ttl, callback) {
        this._getOrSet(key, ttl, callback, obj => obj && obj.id);
        return Game.getObjectById(this.cache[key].data);
    }

    cachedObjCollection(key, ttl, callback) {
        this._getOrSet(key, ttl,callback, objs => objs.map(o => o.id));
        return this.cache[key].data.map(val => Game.getObjectById(val));
    }

    cachedPositions(key, ttl, callback) {
        this._getOrSet(key, ttl,callback, points => points.map(p => p.serialize()));
        return this.cache[key].data.map(val => RoomPosition.unserialize(val));
    }

    cachedCostMatrix(key, ttl, callback) {
        this._getOrSet(key, ttl, callback, obj => obj && obj.serialize().join(','));
        return PathFinder.CostMatrix.deserialize(this.cache[key].data.split(','));
    }
}

profiler.registerClass(CachedData, CachedData.name);

module.exports = {
    CachedData
};