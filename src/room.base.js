var _ = require("lodash");
const utils = require('utils');
const minds = require('mind');

const profiler = require('profiler');

class RoomBase extends utils.Executable {
    constructor(roomName) {
        super();

        this.initRoomBase(roomName);
    }

    initRoomBase(roomName) {
        this.roomName = roomName;

        let room = Game.rooms[roomName];

        Memory.rooms[roomName] = Memory.rooms[roomName] || {};

        if (room) {
            room.manager = this;
            this.room = room;
        }

        this.creeps = tickCache.get('creeps-'+this.roomName, null, []);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));
        this.mindsByType = _.groupBy(this.minds, 'constructor.name');
    }

    get memory() {
        return Memory.rooms[this.roomName];
    }

    getCreepCount(type, memo) {
        return _.size(this.getMinds(type, memo));
    }

    getMinds(type, memo) {
        memo = memo || {};

        let minds = this.mindsByType[type.name] || [];
        if(minds && _.size(memo) > 0) {
            let filterFn = _.matches(memo);
            minds = _.filter(minds, mind => filterFn(mind.creep.memory));
        }

        return minds;
    }

    getCreeps(mind) {
        return this.mindsByType[mind.name];
    }

    getAllMinds() {
        return this.minds;
    }
}

profiler.registerClass(RoomBase, RoomBase.name);

module.exports = {
    RoomBase
};