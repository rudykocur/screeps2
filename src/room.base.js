var _ = require("lodash");
const utils = require('utils');
const minds = require('mind');

class RoomBase extends utils.Executable {
    constructor(roomName) {
        super();

        this.roomName = roomName;

        let room = Game.rooms[roomName];

        Memory.rooms[roomName] = Memory.rooms[roomName] || {};

        if (room) {
            room.manager = this;
            this.room = room;
        }

        this.creeps = _.filter(Game.creeps, "memory.roomName", this.roomName);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));
        this.mindsByType = _.groupBy(this.minds, 'constructor.name');
    }

    get memory() {
        return Memory.rooms[this.roomName];
    }

    getCreepCount(type, memo) {
        memo = memo || {};

        let minds = this.mindsByType[type.name];
        if(minds && _.size(memo) > 0) {
            let filterFn = _.matches(memo);
            minds = minds.filter(mind => filterFn(mind.creep.memory));
        }

        return _.size(minds);
    }

    getCreeps(mind) {
        return this.mindsByType[mind.name];
    }

    getAllMinds() {
        return this.minds;
    }
}

module.exports = {
    RoomBase
};