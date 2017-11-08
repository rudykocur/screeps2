var _ = require("lodash");
const utils = require('utils');
const minds = require('mind');
const maps = require('maps');
const base = require('room.base');
const threat = require('combat.threat');

const profiler = require('profiler');

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

        let cache = maps.getRoomCache(this.roomName);

        if(cache && this.requireAssistance(cache)) {
            this.supportRoom.setSupporting(this);
        }
    }

    requireAssistance(cache) {
        if(cache.getSafeModeUntill() - 400 > Game.time) {
            return false;
        }

        if(cache.findStructures(STRUCTURE_SPAWN).length === 0) {
            return false;
        }

        return true;
    }

    pickSupportRoom() {
        let rooms = this.managers.filter(mgr => {
            if(mgr.room.controller.level <= 6) {
                return false;
            }
            if(mgr.labs.labs.length < 4) {
                return false;
            }

            return true;
        });
        rooms = _.sortBy(rooms, (manager) => Game.map.getRoomLinearDistance(manager.roomName, this.roomName));

        return _.first(rooms);
    }

    getSpawner() {
        let spawn = this.supportRoom.spawner.getFreeSpawn();

        if(spawn) {
            return this.supportRoom;
        }
    }

    spawn(mind, options) {
        let manager = this.getSpawner();

        if(manager) {
            return manager.spawner.spawn(this, mind.getSpawnParams(manager, options));

        }
    }

    update() {

        if(!this.room) {
            if (this.getCreepCount(minds.available.scout) === 0) {
                if (this.spawn(minds.available.scout)) {
                    this.important('Spawned scout');
                }
            }
        }
        else {
            this.memory.hasCombatCreeps = this.threat.getCombatCreeps().length > 0;
        }

        if(this.willNeedBreacher()) {
            this.supportRoom.labs.loadBoosts(Memory.siegeCreep.boosts);
        }

        if (this.shouldSpawnBreacher()) {

            if (this.spawn(minds.available.breach)) {
                this.important('Spawned breach creep');
            }
        }

        if(this.shouldSpawnDefender()) {
            if (this.spawn(minds.available.breach, {withBoosts: false})) {
                this.important('Spawned defender');
            }
        }

        if(this.shouldSpawnClaimer()) {
            if(this.spawn(minds.available.claimer)) {
                this.important('Spawned claimer');
            }
        }
    }

    willNeedBreacher() {
        let cache = maps.getRoomCache(this.roomName);

        if(!cache) {
            return false
        }

        if(cache.getSafeModeUntill() - 400 > Game.time) {
            return false;
        }

        if(cache.findStructures(STRUCTURE_SPAWN).length > 0) {
            return true;
        }

        return false;
    }

    shouldSpawnBreacher() {
        if(this.getCreepCount(minds.available.breach) > 1) {
            return false;
        }

        if(!this.supportRoom.labs.areBoostsReady()) {
            return false;
        }

        return this.willNeedBreacher();
    }

    shouldSpawnDefender() {
        if(!this.room) {
            return false;
        }

        if(this.getCreepCount(minds.available.breach, {withBoosts: false}) > 1) {
            return false;
        }

        let cache = maps.getRoomCache(this.roomName);

        if(!cache) {
            return false;
        }

        if(cache.findStructures(STRUCTURE_SPAWN).length > 0) {
            return false;
        }

        if(cache.getSafeModeUntill() > Game.time) {
            return false;
        }

        if(this.memory.hasCombatCreeps) {
            return true;
        }

        if(this.threat.enemies.length > 0) {
            return true;
        }

        return false;
    }

    shouldSpawnClaimer() {
        let cache = maps.getRoomCache(this.roomName);

        if(!cache) {
            return false;
        }

        if(cache.getSafeModeUntill() > Game.time) {
            return false;
        }

        if(cache.findStructures(STRUCTURE_SPAWN).length > 0) {
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

profiler.registerClass(RoomSiege, RoomSiege.name);

module.exports = {
    RoomSiege
};