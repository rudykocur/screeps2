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

        this.supportRoom = this.pickSupportRoom();

        if(this.room) {
            this.enemies = this.room.find(FIND_HOSTILE_CREEPS);

            this.threat = new threat.ThreatAssesment(this.enemies);
        }
    }

    pickSupportRoom() {
        let rooms = this.managers.filter(mgr => mgr.room.controller.level > 6);
        rooms = _.sortBy(rooms, (manager) => Game.map.getRoomLinearDistance(manager.roomName, this.roomName));

        return _.first(rooms);
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

        if (this.shouldSpawnBreacher()) {
            if (this.spawn(minds.available.breach)) {
                this.important('Spawned breach creep');
            }
        }

        if(this.shouldSpawnClaimer()) {
            if(this.spawn(minds.available.claimer)) {
                this.important('SPAWNED CLAIMER !!!!');
            }
        }
    }

    shouldSpawnBreacher() {
        if(this.getCreepCount(minds.available.breach) > 1) {
            return false;
        }

        if(!this.supportRoom.labs.areBoostsReady()) {
            return false;
        }

        let cache = maps.getRoomCache(this.roomName);

        if(cache.findStructures(STRUCTURE_SPAWN).length > 0) {
            return true;
        }

        if(cache.findStructures(STRUCTURE_TOWER).length > 0) {
            return true;
        }

        return false;
    }

    shouldSpawnClaimer() {
        let cache = maps.getRoomCache(this.roomName);

        if(cache.find(STRUCTURE_SPAWN).length > 0) {
            return false;
        }

        if(!cache.isOwned()) {
            return false;
        }

        if(cache.ownedByMe()) {
            return false;
        }

        if(this.room && this.room.controller.upgradeBlocked > 300) {
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