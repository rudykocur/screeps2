var _ = require("lodash");
const maps = require('maps');
const base = require('room.base');
const minds = require('mind');

const profiler = require('profiler');

class RoomScout extends base.RemotelySupportedRoom {
    constructor(roomName, regularRooms, flag) {
        super(roomName, regularRooms);

        this.flag = flag;

        this.setSupportedManagersRange(5);
    }

    update() {
        /**
         * @type {CachedRoom}
         */
        let cache = maps.getRoomCache(this.roomName);

        if(cache) {
            // do something with cache
        }

        if(!cache || cache.cacheAge > 10000) {
            if(this.getCreepCount(minds.available.scout) === 0) {
                let res = this.spawn(minds.available.scout);

                if(res) {
                    this.important('Send scout for refresh', res);
                }
            }
        }
    }

    toString() {
        return `[RoomScout for ${this.getRoomLink()}]`;
    }

}

profiler.registerClass(RoomScout, RoomScout.name);

module.exports = {
    RoomScout
};