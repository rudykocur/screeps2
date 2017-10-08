let mind_scout = require('mind.scout');

class RemoteRoomsManager {

    /**
     * @param {RoomManager} manager
     */
    constructor(manager) {
        this.manager = manager;

        this.manager.room.memory.remoteRooms = this.manager.room.memory.remoteRooms || {};
    }

    get memory(){
        return this.manager.room.memory.remoteRooms;
    }

    getHandlers() {
        return (this.memory.roomNames || []).map(name => new RemoteRoomHandler(name, this.manager));
    }

    update() {
        for(let handler of this.getHandlers()) {
            handler.update();
        }

        this.memory.roomNames = this.getRemoteRoomNames();
    }

    getRemoteRoomNames() {
        let rooms = this.getExitRooms(this.manager.room);
        // console.log('Enabled exits: ', rooms);
        return rooms;
    }

    /**
     * @param {Room} room
     */
    getExitRooms(room) {
        let exitFlags = _.filter(Game.flags, /**Flag*/ f => {
            if(f.room != room) {
                return;
            }

            return f.color == COLOR_PURPLE && f.secondaryColor == COLOR_PURPLE;
        });

        let availableExits = Game.map.describeExits(room.name);
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
        if(flat.pos.y == 49) {
            return BOTTOM;
        }
    }
}

class RemoteRoomHandler {
    /**
     * @param roomName
     * @param {RoomManager} parentManager
     */
    constructor(roomName, parentManager) {
        this.roomName = roomName;
        this.parent = parentManager;

        this.room = Game.rooms[this.roomName];

        if(!Memory.rooms[this.roomName]) {
            Memory.rooms[this.roomName] = {type: 'remote'};
        }
    }

    get memory() {
        return Memory.rooms[this.roomName];
    }

    update() {
        // console.log(this, 'updating ...');
        if(!this.room) {
            if(!this.memory.scoutName) {
                let name = this.spawnScout();
                if (name) {
                    this.memory.scoutName = name;
                    console.log(this, 'Scout ', name, 'is sent');
                }
            }

            return;
        }

        if(!this.memory.remoteStructures) {
            this.memory.remoteStructures = this.findRemoteStructures(this.room);
        }
    }

    spawnScout() {
        let spawn = this.parent.spawner.getFreeSpawn();

        if(spawn) {
            return this.parent.spawner.spawn(spawn, mind_scout.ScoutMind.getSpawnParams(this.parent, this.roomName));
        }
    }

    findRemoteStructures(room) {
        return {
            controller: {
                id: room.controller.id,
                pos: room.controller.pos
            },
            sources: _.map(room.find(FIND_SOURCES), src => {
                return {pos: src.pos, id: src.id}
            })
        }
    }

    toString() {
        return '[Remote handler for ' + (this.room || this.roomName) + ']';
    }
}

module.exports = {
    RemoteRoomsManager
};