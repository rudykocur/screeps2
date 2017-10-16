var _ = require('lodash');

function hydrate(item) {
    item.pos.__proto__ = RoomPosition.prototype;
    return item;
}

function getCacheForRoom(roomName) {
    if(!Memory.cache) {
        Memory.cache = {}
    }

    _.defaults(Memory.cache, {rooms: {}});

    Memory.cache.rooms[roomName] = (Memory.cache.rooms[roomName] || {});

    _.defaults(Memory.cache.rooms[roomName], {roomName: roomName, data: [], lastUpdateTime: 0});

    return Memory.cache.rooms[roomName];
}

/**
 * @param {Room} room
 */
function scanRoom(room) {
    let result = [];

    room.find(FIND_STRUCTURES).forEach(struct => {
        result.push(_.pick(struct, ['pos', 'structureType', 'id']));
    });

    return result;
}

class CachedRoom {
    constructor(roomName) {
        this.name = roomName;

        this.cache = getCacheForRoom(roomName);
    }

    belongsToUser(username) {
        return this.cache.owner == username || this.cache.reservedBy == username;
    }

    isFree() {
        return !this.cache.owner  && !this.cache.reservedBy;
    }

    get controller() {
        return this.getStructure(STRUCTURE_CONTROLLER);
    }

    find(type) {
        return this.cache.data.map(hydrate);
    }

    findStructures(structType) {
        return _.filter(this.cache.data, 'structureType', structType).map(hydrate);
    }

    getStructure(structType) {
        return _.first(this.findStructures(structType));
    }

    toString() {
        return `[CachedRoom ${this.name}]`;
    }
}

module.exports = {
    getRoomCache(roomName) {
        return new CachedRoom(roomName);
    },

    getCostMatrix(roomName, costs) {
        let room = module.exports.getRoomCache(roomName);

        if(!costs) {
            costs = new PathFinder.CostMatrix;
        }

        room.find(FIND_STRUCTURES).forEach(function(struct) {
          if (struct.structureType === STRUCTURE_ROAD) {
            // Favor roads over plain tiles
            costs.set(struct.pos.x, struct.pos.y, 1);
          } else if (OBSTACLE_OBJECT_TYPES.indexOf(struct.structureType) >= 0) {
            // Can't walk through non-walkable buildings
            costs.set(struct.pos.x, struct.pos.y, 0xff);
          }
        });

        return costs;
    },

    blockHostileRooms(roomName, costMatrix) {
        let myRoom = _.first(_.filter(Game.rooms, r => r.controller.my));

        let myUser = myRoom.controller.owner.username;

        let cachedRoom = module.exports.getRoomCache(roomName);

        if(cachedRoom.isFree()) {
            return costMatrix;
        }

        if(!cachedRoom.belongsToUser(myUser)) {
            return false;
        }

        return costMatrix;
    },

    updateRoomCache(room, ttl) {
        ttl = ttl || 0;

        let cache = getCacheForRoom(room.name);
        let currentTTL = Game.time - cache.lastUpdateTime;

        if(currentTTL > ttl) {
            cache.data = scanRoom(room);

            cache.owner = room.controller.owner ? room.controller.owner.username : null;
            cache.reservedBy = room.controller.reservation ? room.controller.reservation.username : null;

            cache.lastUpdateTime = Game.time;
        }
    }
};