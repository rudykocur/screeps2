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
        this._getOrSet(key, ttl,callback, objs => objs.map(o => o.id).join(';'));

        let data = this.cache[key].data;
        if(data) {
            return this._deserializeObjCollectionListLo(data);
        }

        return [];
    }

    _splitData(data) {
        return data.split(';');
    }

    _deserializeObjCollectionListLo(data) {
        return _.filter(this._splitData(data).map(val => this._gobi(val)));
    }

    _gobi(val) {
        return Game.getObjectById(val);
    }

    cachedPositions(key, ttl, callback) {
        this._getOrSet(key, ttl,callback, points => points.map(p => p.serialize()).join(';'));

        let data = this.cache[key].data;
        if(data) {
            return data.split(';').map(val => RoomPosition.unserialize(val));
        }

        return [];
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