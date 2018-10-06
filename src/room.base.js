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

        this.name = this.memory.roomName;
        this.namingGroup = this.memory.namingGroup;

        this.creeps = tickCache.get('creeps-'+this.roomName, null, []);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));
        this.mindsByType = _.groupBy(this.minds, 'constructor.name');
    }

    setNamingGroup(groupName) {
        this.warn('Room associated with naming group', groupName);
        this.memory.namingGroup = groupName;
        this.namingGroup = groupName;
    }

    setRoomName(name) {
        this.warn('Setting room name to', name);
        this.memory.roomName = name;
        this.name = name;
    }

    getRoomTitle() {
        return this.name;
    }

    getRoomLink() {
        return utils.getRoomLink(this.roomName, this.name || this.roomName);
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


class RemotelySupportedRoom extends RoomBase {
    constructor(roomName, regularRooms) {
        super(roomName);

        this.managers = regularRooms;
    }

    setSupportedManagersRange(maxRange) {
        this.managers = this.managers
            .filter(mgr => Game.map.getRoomLinearDistance(mgr.roomName, this.roomName) <= maxRange);
    }

    getSpawner(nearest) {
        let managers = _.sortBy(this.managers, mgr => Game.map.getRoomLinearDistance(mgr.roomName, this.roomName));
        managers = managers.filter(m => m.room.controller.level > 3);

        for(let mgr of managers) {
            let spawn = mgr.spawner.getFreeSpawn();

            if (spawn) {
                return mgr;
            }

            if(nearest) {
                break;
            }
        }
    }

    spawn(mind, options, nearest) {
        let manager = this.getSpawner(nearest);

        if(manager) {
            return manager.spawner.spawn(this, mind.getSpawnParams(manager, options));

        }
    }
}

profiler.registerClass(RoomBase, RoomBase.name);
profiler.registerClass(RemotelySupportedRoom, RemotelySupportedRoom.name);

module.exports = {
    RoomBase, RemotelySupportedRoom
};