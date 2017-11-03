var _ = require('lodash');
const utils = require('utils');

function hydrate(item) {
    if(_.isString(item.pos)) {
        let parts = item.pos.split(',');
        item.pos = new RoomPosition(parts[0], parts[1], parts[2]);
    }
    else {
        item.pos = new RoomPosition(item.pos.x, item.pos.y, item.pos.roomName);
    }
    // item.pos.__proto__ = RoomPosition.prototype;
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

function hasCacheForRoom(roomName) {
    return !!_.get(Memory, ['cache', 'rooms', roomName]);
}

/**
 * @param {Room} room
 */
function scanRoom(room) {
    let result = [];

    room.find(FIND_STRUCTURES).forEach(struct => {
        let obj = _.pick(struct, ['pos', 'structureType', 'id']);
        obj._typeId = FIND_STRUCTURES;
        result.push(obj);
    });

    for(let type of [FIND_SOURCES, FIND_MINERALS]) {
        room.find(type).forEach(src => {
            let obj = _.pick(src, ['pos', 'id']);
            obj._typeId = type;
            result.push(obj);
        });
    }

    return result;
}

class CachedRoom {
    constructor(roomName) {
        this.name = roomName;

        this.cache = getCacheForRoom(roomName);
        this.cache.data = this.cache.data.map(hydrate);
    }

    get cacheAge() {
        return Game.time - this.cache.lastUpdateTime
    }

    belongsToUser(username) {
        return this.cache.owner == username || this.cache.reservedBy == username;
    }

    ownedBy(username) {
        return this.cache.owner == username;
    }

    ownedByEnemy() {
        return this.isOwned() && !this.ownedBy(utils.myUsername());
    }

    ownedByMe() {
        return this.ownedBy(utils.myUsername());
    }

    isOwned() {
        return !!this.cache.owner;
    }

    isFree() {
        return !this.cache.owner  && !this.cache.reservedBy;
    }

    get controller() {
        return this.getStructure(STRUCTURE_CONTROLLER);
    }

    getSafeModeUntill() {
        return this.cache.safeModeUntill;
}

    find(type) {
        return this.cache.data.filter(obj => obj._typeId === type || (!obj._typeId && type === FIND_STRUCTURES));
    }

    findStructures(structType) {
        return _.filter(this.cache.data, 'structureType', structType);
    }

    getStructure(structType) {
        return _.first(this.findStructures(structType));
    }

    toString() {
        return `[CachedRoom ${this.name}]`;
    }
}
function getRoomCache(roomName) {
    return tickCache.get('maps-roomCache-'+roomName, () => {
        if(!hasCacheForRoom(roomName)) {
            return null;
        }

        return new CachedRoom(roomName);
    });
}

module.exports = {
    getRoomCache,

    getCostMatrix(roomName, costs) {
        let cache = getRoomCache(roomName);

        if(!costs) {
            costs = new PathFinder.CostMatrix;
        }

        if(cache) {
            cache.find(FIND_STRUCTURES).forEach(function (struct) {
                if (struct.structureType === STRUCTURE_ROAD) {
                    // Favor roads over plain tiles
                    costs.set(struct.pos.x, struct.pos.y, 1);
                } else if (OBSTACLE_OBJECT_TYPES.indexOf(struct.structureType) >= 0) {
                    // Can't walk through non-walkable buildings
                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                }
            });
        }

        return costs;
    },

    blockHostileRooms(roomName, costMatrix) {
        if(!hasCacheForRoom(roomName)) {
            return costMatrix;
        }

        let myUser = utils.myUsername();

        let cachedRoom = module.exports.getRoomCache(roomName);

        if(cachedRoom.isFree()) {
            return costMatrix;
        }

        if(!cachedRoom.belongsToUser(myUser)) {
            return false;
        }

        return costMatrix;
    },

    /**
     * @param {RoomPosition} from
     * @param {RoomPosition} to
     * @param {Object} options
     */
    getMultiRoomPath(from, to, options) {
        _.defaults(options || {}, {
            avoidHostile: true,
            roomCallback: null,
            ignoreLairs: [],
            ignoreAllLairs: false,
        });

        let myUser = utils.myUsername();

        let allowedRooms = { [ from.roomName ]: true };

        let roomRoute = Game.map.findRoute(from.roomName, to.roomName, {
            routeCallback(roomName) {
                let cache = getRoomCache(roomName);
                if(cache) {

                    if(cache.isFree()) {
                        return 1;
                    }

                    if(cache.ownedBy(myUser)) {
                        return 1;
                    }

                    if(options.avoidHostile && cache.isOwned()) {
                        return Infinity;
                    }
                }

                return 1;
            }
        });

        if(roomRoute === ERR_NO_PATH) {
            console.log('WARNING - no route', from, 'to', to);
            return null;
        }

        roomRoute.forEach(function(info) {
            allowedRooms[info.room] = true;
        });

        let ret = PathFinder.search(from, to, {
            maxOps: Math.min(_.size(allowedRooms) * 1500, 15000),
            plainCost: 2,
            swampCost:5,
            roomCallback(roomName) {
                if (allowedRooms[roomName] === undefined) {
                    return false;
                }

                let matrix = new PathFinder.CostMatrix;

                let cache = getRoomCache(roomName);
                if(cache) {

                    for(let struct of cache.find(FIND_STRUCTURES)) {
                        if(OBSTACLE_OBJECT_TYPES.indexOf(struct.structureType)>=0) {
                            matrix.set(struct.pos.x, struct.pos.y, 0xff);
                        }
                        else if (struct.structureType === STRUCTURE_ROAD) {
                            matrix.set(struct.pos.x, struct.pos.y, 1);
                        }
                    }

                    if(!options.ignoreAllLairs) {
                        let lairs = cache.findStructures(STRUCTURE_KEEPER_LAIR);

                        for(let lair of lairs) {
                            if(options.ignoreLairs.length === 0 || options.ignoreLairs.indexOf(lair.id) < 0 ) {
                                let unsafe = utils.getAround(lair.pos, 5);

                                for (let point of unsafe) {
                                    matrix.set(point.x, point.y, 0xFF);
                                }
                            }

                        }
                    }
                }

                let room = Game.rooms[roomName];
                if(room) {
                    _.each(Game.creeps, creep => {
                        if(creep.room == room && creep.memory.isStationary){
                            matrix.set(creep.pos.x, creep.pos.y, 0xFF);
                        }
                    })
                }

                if(options.roomCallback) {
                    options.roomCallback(roomName, matrix)
                }

                return matrix;
            }
        });

        for(let step of ret.path) {
            let vis = new RoomVisual(step.roomName);
            vis.circle(step, {});
        }

        return ret.path;
    },

    updateRoomCache(room, ttl) {
        ttl = ttl || 0;

        let cache = getCacheForRoom(room.name);
        let currentTTL = Game.time - cache.lastUpdateTime;

        if(currentTTL > ttl) {
            if(ttl > 0) {
                console.log(`[maps] updating cache for room ${room.name}`);
            }

            cache.data = scanRoom(room);
            cache.owner = null;
            cache.reservedBy = null;
            cache.safeModeUntill = null;

            if(room.controller) {
                cache.owner = room.controller.owner ? room.controller.owner.username : null;
                cache.reservedBy = room.controller.reservation ? room.controller.reservation.username : null;
                if(room.controller.safeMode > 0) {
                    cache.safeModeUntill = room.controller.safeMode + Game.time;
                }
            }

            cache.lastUpdateTime = Game.time + utils.roomNameToInt(room.name) % 21;
        }
    }
};