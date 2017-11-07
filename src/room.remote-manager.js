var _ = require("lodash");
const maps = require('maps');
const utils = require('utils');
const remote = require('room.remote');
const remoteSK = require('room.remote-sk');

const profiler = require('profiler');

class RemoteRoomsManager extends utils.Executable {

    /**
     * @param {RoomManager} manager
     */
    constructor(manager) {
        super();

        this.manager = manager;
        this.jobManager = manager.jobManager;

        this.initRooms();
    }

    initRooms() {
        this.manager.room.memory.remoteRooms = this.manager.room.memory.remoteRooms || {};

        if(this.manager.room.controller.level >= 3) {
            this.handlers = (this.memory.roomNames || []).map(
                name => {
                    let cache = maps.getRoomCache(name);
                    if(cache && cache.find(FIND_SOURCES).length > 2) {
                        return new remoteSK.RemoteSKRoomHandler(name, this.manager);
                    }

                    return new remote.RemoteRoomHandler(name, this.manager)
                });
        }
        else {
            this.handlers = [];
        }
    }

    get memory(){
        return this.manager.room.memory.remoteRooms;
    }

    getAllMinds() {
        let result = [];

        for(let remote of this.handlers) {
            result = result.concat(remote.minds);
        }

        return result;
    }

    update() {
        for (let handler of this.handlers) {
            handler.prioritySpawn();
        }

        for (let handler of this.handlers) {
            handler.run();
        }

        this.memory.roomNames = this.getRemoteRoomNames();
    }

    getRemoteRoomNames() {
        let toCheck = this.getExitRooms(this.manager.room.name);

        let result = [];

        while(toCheck.length > 0) {
            let roomName = toCheck.pop();

            result.push(roomName);

            let newRooms = this.getExitRooms(roomName);

            toCheck = toCheck.concat(newRooms);
        }

        return result;
    }

    /**
     * @param roomName
     */
    getExitRooms(roomName) {
        let exitFlags = _.filter(Game.flags, /**Flag*/ f => {
            if(f.pos.roomName != roomName) {
                return;
            }

            return f.color == COLOR_PURPLE && f.secondaryColor == COLOR_PURPLE;
        });

        let availableExits = Game.map.describeExits(roomName);
        let exits = [];

        exitFlags.forEach(/**Flag*/ flag => {
            let exitDirection = this.getExitFlagDirection(flag);
            exits.push(availableExits[exitDirection]);
        });

        return exits;
    }

    /**
     * @param {Flag} flag
     */
    getExitFlagDirection(flag) {
        if(flag.pos.x === 0) {
            return LEFT;
        }
        if(flag.pos.y === 0) {
            return TOP;
        }
        if(flag.pos.x === 49) {
            return RIGHT;
        }
        if(flag.pos.y == 49) {
            return BOTTOM;
        }
    }

    toString() {
        return `[RemoteRoomsManager for ${this.manager.room}]`;
    }
}

profiler.registerClass(RemoteRoomsManager, RemoteRoomsManager.name);

module.exports = {
    RemoteRoomsManager
};