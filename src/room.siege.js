var _ = require("lodash");
const utils = require('utils');
const minds = require('mind');
const maps = require('maps');

class RoomSiege extends utils.Executable {
    constructor(roomName, flag, regularRooms) {
        super();

        this.roomName = roomName;
        this.flag = flag;
        this.managers = regularRooms;

        let room = Game.rooms[roomName];

        if(room) {
            room.manager = this;
            this.room = room;
        }

        this.creeps = _.filter(Game.creeps, "memory.roomName", this.roomName);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));
        this.mindsByType = _.groupBy(this.minds, 'constructor.name');
    }

    getSpawner() {
        for(let mgr of this.managers) {
            let spawn = mgr.spawner.getFreeSpawn();

            if(spawn) {
                return mgr;
            }
        }
    }

    spawn(mind) {
        let manager = this.getSpawner();

        if(manager) {
            return manager.spawner.spawn(this, mind.getSpawnParams(manager));

        }
    }

    getCreepCount(type) {
        return _.size(this.mindsByType[type.name]);
    }

    update() {
        // console.log(this, 'updated ...');
        // let cache = maps.getRoomCache(this.roomName);

        // console.log(this, '::', cache.findStructures(STRUCTURE_SPAWN).length);

        if(this.getCreepCount(minds.available.scout) === 0) {
            if(this.spawn(minds.available.scout)) {
                console.log(this, 'Spawned scout');
            }
        }

        if(this.room) {
            if(this.shouldSpawnClaimer()) {
                if(this.spawn(minds.available.claimer)) {
                    console.log(this, 'SPAWNED CLAIMER !!!!');
                }
            }
        }
    }

    shouldSpawnClaimer() {
        if(this.room.findStructures(STRUCTURE_SPAWN).length > 0) {
            return false;
        }

        if(!this.room.controller.owner) {
            return false;
        }

        if(this.room.controller.my) {
            return false;
        }

        if(this.room.controller.upgradeBlocked > 0) {
            return false;
        }

        if(this.getCreepCount(minds.available.claimer) > 0) {
            return false;
        }

        return true;
    }

    toString() {
        return `[RoomSiege for ${this.roomName}]`;
    }

}

module.exports = {
    RoomSiege
};