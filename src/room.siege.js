var _ = require("lodash");
const utils = require('utils');
const minds = require('mind');
const maps = require('maps');
const base = require('room.base');

class RoomSiege extends base.RoomBase {
    constructor(roomName, flag, regularRooms) {
        super(roomName);

        this.flag = flag;
        this.managers = regularRooms;
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

    update() {

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