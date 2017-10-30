var _ = require("lodash");
const utils = require('utils');
const minds = require('mind');

class RoomBase extends utils.Executable {
    constructor(roomName) {
        super();

        this.roomName = roomName;

        let room = Game.rooms[roomName];

        if (room) {
            room.manager = this;
            this.room = room;
        }

        this.creeps = _.filter(Game.creeps, "memory.roomName", this.roomName);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));
        this.mindsByType = _.groupBy(this.minds, 'constructor.name');
    }

    getCreepCount(type) {
        return _.size(this.mindsByType[type.name]);
    }

    getAllMinds() {
        return this.minds;
    }
}

module.exports = {
    RoomBase
};