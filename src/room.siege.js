var _ = require("lodash");
const utils = require('utils');
const minds = require('mind');
const maps = require('maps');
const base = require('room.base');
const threat = require('combat.threat');

class RoomSiege extends base.RoomBase {
    constructor(roomName, flag, regularRooms) {
        super(roomName);

        this.flag = flag;
        this.managers = regularRooms;

        this.supportRoom = _.first(this.managers.filter(mgr => mgr.room.controller.level > 6));

        if(this.room) {
            this.enemies = this.room.find(FIND_HOSTILE_CREEPS);

            this.threat = new threat.ThreatAssesment(this.enemies);
        }
    }

    getSpawner() {
        let spawn = this.supportRoom.spawner.getFreeSpawn();

        if(spawn) {
            return this.supportRoom;
        }
    }

    spawn(mind) {
        let manager = this.getSpawner();

        if(manager) {
            return manager.spawner.spawn(this, mind.getSpawnParams(manager));

        }
    }

    update() {

        let cache = maps.getRoomCache(this.roomName);

        if(!this.room) {
            if (this.getCreepCount(minds.available.scout) === 0) {
                if (this.spawn(minds.available.scout)) {
                    this.important('Spawned scout');
                }
            }
        }

        if(cache && cache.cacheAge < 1000) {
            if (this.getCreepCount(minds.available.breach) === 0 && this.supportRoom.labs.areBoostsReady()) {
                // if (this.spawn(minds.available.breach)) {
                //     this.important('Spawned breach creep');
                // }
            }
        }

        if(this.room) {
            if(this.shouldSpawnClaimer()) {
                if(this.spawn(minds.available.claimer)) {
                    this.important(this, 'SPAWNED CLAIMER !!!!');
                }
            }
        }
    }

    shouldSpawnClaimer() {
        if(this.room.find(STRUCTURE_SPAWN).length > 0) {
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