var _ = require('lodash');
const utils = require('utils');

function hydrate(item) {
    item.pos = new RoomPosition(item.pos.x, item.pos.y, item.pos.roomName);
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

    isOwned() {
        return !!this.cache.owner;
    }

    isFree() {
        return !this.cache.owner  && !this.cache.reservedBy;
    }

    get controller() {
        return this.getStructure(STRUCTURE_CONTROLLER);
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

module.exports = {
    getRoomCache(roomName) {
        if(!hasCacheForRoom(roomName)) {
            return null;
        }

        return new CachedRoom(roomName);
    },

    getCostMatrix(roomName, costs) {
        let room = module.exports.getRoomCache(roomName);

        if(!costs) {
            costs = new PathFinder.CostMatrix;
        }

        if(room) {
            room.find(FIND_STRUCTURES).forEach(function (struct) {
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
        _.defaults(options, {avoidHostile: true, roomCallback: null});

        let myUser = utils.myUsername();

        let allowedRooms = { [ from.roomName ]: true };

        Game.map.findRoute(from.roomName, to.roomName, {
            routeCallback(roomName) {
                if(hasCacheForRoom(roomName)) {
                    let cache = new CachedRoom(roomName);

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
        }).forEach(function(info) {
            allowedRooms[info.room] = true;
        });

        let ret = PathFinder.search(from, to, {
            maxOps: 20000,
            roomCallback(roomName) {
                if (allowedRooms[roomName] === undefined) {
                    return false;
                }

                let matrix = new PathFinder.CostMatrix;

                if(hasCacheForRoom(roomName)) {
                    let cache = new CachedRoom(roomName);

                    for(let struct of cache.find(FIND_STRUCTURES)) {
                        if(OBSTACLE_OBJECT_TYPES.indexOf(struct.structureType)>=0) {
                            matrix.set(struct.pos.x, struct.pos.y, 0xff);
                        }
                    }

                    let sources = cache.find(FIND_SOURCES);
                    if(sources.length == 3) {
                        let mineral = _.first(cache.find(FIND_MINERALS));
                        sources.push(mineral);
                        for(let src of sources) {
                            let unsafe = utils.getAround(src.pos, 5);
                            for(let point of unsafe) {
                                matrix.set(point.x, point.y, 0xFF);
                            }
                        }
                    }
                }

                let room = Game.rooms[roomName];
                if(room) {
                    let mgr = room.manager;
                    if(mgr) {
                        for(let creep of mgr.creeps) {
                            if(creep.memory.isStationary) {
                                matrix.set(creep.pos.x, creep.pos.y, 0xFF);
                            }
                        }
                    }
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

            if(room.controller) {
                cache.owner = room.controller.owner ? room.controller.owner.username : null;
                cache.reservedBy = room.controller.reservation ? room.controller.reservation.username : null;
            }
            else {
                cache.owner = null;
                cache.reservedBy = null;
            }


            cache.lastUpdateTime = Game.time;
        }
    }
};