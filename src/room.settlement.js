var _ = require("lodash");
const utils = require('utils');
const maps = require('maps');

class RoomSettlement extends utils.Executable {
    constructor(roomName, claimFlag, regularRooms) {
        super();

        this.roomName = roomName;
        this.flag = claimFlag;

        let room = Game.rooms[roomName];

        if(room) {
            room.manager = this;
            this.room = room;
        }

        this.minds = [];
    }

    update() {
        // console.log(this, 'updated ...');
        let creepName = 'wanderer_' + this.roomName;
        let wanderer = Game.creeps[creepName];
        if(!wanderer) {
            for(let spawn of _.values(Game.spawns)) {
                if(spawn.spawnCreep([MOVE], creepName) === OK) {
                    console.log(this, 'spawned', creepName);
                    break;
                }
            }
        }
        else {
            let claimPath = maps.getMultiRoomPath(wanderer.pos, this.flag.pos);
            let x = wanderer.moveByPath(claimPath);
        }

    }

    toString() {
        return `[RoomSettlement for ${this.roomName}]`;
    }

}

module.exports = {
    RoomSettlement
};