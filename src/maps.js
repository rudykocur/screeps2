var _ = require('lodash');
const utils = require('utils');
const CachedData= require('utils.cache').CachedData;
const lz = require('lz-string');

const roomCache = require('cache.rooms');

const getRoomCache = roomCache.getRoomCache;

const profiler = require('profiler');

/**
 * @param {String} roomName
 * @param {CachedData} data
 * @param {NamedTimer} timer
 * @return {PathFinder.CostMatrix}
 */
function generateCostMatrix(roomName, data, timer, options) {
    timer.start('static');

    let matrix = data.cachedCostMatrix('cm-'+roomName, 500, () => {
        let result = new PathFinder.CostMatrix;

        let cache = getRoomCache(roomName, true);
        if(cache) {

            for(let struct of cache.find(FIND_STRUCTURES)) {
                if(OBSTACLE_OBJECT_TYPES.indexOf(struct.structureType)>=0) {
                    result.set(struct.pos.x, struct.pos.y, 0xff);
                }
                else if(struct.structureType === STRUCTURE_RAMPART && struct.my === false && struct.isPublic === false) {
                    result.set(struct.pos.x, struct.pos.y, 0xff);
                }
                else if (struct.structureType === STRUCTURE_ROAD) {
                    result.set(struct.pos.x, struct.pos.y, 1);
                }
            }

            if(!options.ignoreAllLairs) {
                let lairs = cache.findStructures(STRUCTURE_KEEPER_LAIR);

                for(let lair of lairs) {
                    if(options.ignoreLairs.length === 0 || options.ignoreLairs.indexOf(lair.id) < 0 ) {
                        let unsafe = utils.getAround(lair.pos, 5);

                        for (let point of unsafe) {
                            result.set(point.x, point.y, 0xFF);
                        }
                    }
                }
            }
        }

        return result;
    });

    timer.stop('static');
    timer.start('creeps');

    let room = Game.rooms[roomName];
    if(room) {
        _.each(Game.creeps, creep => {
            if(creep.room == room && creep.memory.isStationary){
                matrix.set(creep.pos.x, creep.pos.y, 0xFF);
            }
        });

        room.find(FIND_HOSTILE_CREEPS).forEach(creep => {
            matrix.set(creep.pos.x, creep.pos.y, 0xFF);
        });

        room.find(FIND_CONSTRUCTION_SITES).forEach(/**ConstructionSite*/site => {
            if(site.structureType !== STRUCTURE_ROAD && site.structureType !== STRUCTURE_RAMPART) {
                matrix.set(site.pos.x, site.pos.y, 0xFF);
            }
        })
    }

    timer.stop('creeps');

    return matrix;
}

let pathTimer = new utils.NamedTimer(['local', 'localMulti', 'remote']);

/**
 *
 * @param {Room} room
 * @param from
 * @param to
 * @param {MultiroomPathOptions} options
 */
function getLocalPath(room, from, to, options) {
    let targets, res;

    if(options.targets) {

        pathTimer.start('localMulti');

        let data = new CachedData(Memory.cache.maps);
        let timer = new utils.NamedTimer();

        let path = PathFinder.search(from, options.targets, {
            maxRooms: 1,
            roomCallback: (roomName) => {
                return generateCostMatrix(roomName, data, timer, options);
            }
        });

        pathTimer.stop('localMulti');

        res = path.path;
    }
    else {

        pathTimer.start('local');

        let path = room.findPath(from, to, {
            ignoreCreeps: true,
            maxRooms: 1,
            costCallback: (roomName, matrix) => {
                if(roomName == room.name) {
                    _.each(Game.creeps, creep => {
                        if(creep.room == room && creep.memory.isStationary){
                            matrix.set(creep.pos.x, creep.pos.y, 0xFF);
                        }
                    });

                    room.find(FIND_HOSTILE_CREEPS).forEach(creep => {
                        matrix.set(creep.pos.x, creep.pos.y, 0xFF);
                    })
                }
            }
        });

        res = path.map(step => RoomPosition.asPosition(step, room.name));

        pathTimer.stop('local');
    }

    return res;
}

function canMoveInRoom(roomName, options, myUser) {
    let cache = getRoomCache(roomName, true);
    if(cache) {

        if(!options.allowSKRooms && cache.isSKRoom()) {
            return false;
        }

        if(cache.isFree()) {
            return true;
        }

        if(cache.ownedBy(myUser)) {
            return true;
        }

        if(options.avoidHostile && cache.isOwned()) {
            return false;
        }
    }

    return true;
}

generateCostMatrix = profiler.registerFN(generateCostMatrix, 'maps.generateCostMatrix');

/**
 * @typedef {Object} MultiroomPathOptions
 * @property {Boolean} avoidHostile
 * @property roomCallback
 * @property ignoreLairs
 * @property maxOps
 * @property {Boolean} ignoreAllLairs
 * @property {Boolean} allowSKRooms
 * @property {Boolean} debug
 * @property {Boolean} visualize
 * @property {Array<RoomPosition>|null} targets
 */


module.exports = {

    /**
     * @return {CachedRoom}
     */
    getRoomCache,

    pathTimer,

    getCostMatrix(roomName, costs) {
        let cache = getRoomCache(roomName, true);

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
        if(!roomCache.hasCacheForRoom(roomName)) {
            return costMatrix;
        }

        let myUser = utils.myUsername();

        let cachedRoom = module.exports.getRoomCache(roomName, true);

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
     * @param {MultiroomPathOptions} options
     *
     * @return {Array<RoomPosition>}
     */
    getMultiRoomPath(from, to, options) {
        options = _.defaults(options || {}, {
            avoidHostile: true,
            roomCallback: null,
            ignoreLairs: [],
            ignoreAllLairs: false,
            allowSKRooms: true,
            debug: false,
            visualize: true,
            targets: null,
            maxOps: 10000,
        });

        let fromRoom = Game.rooms[from.roomName];
        if(fromRoom && from.roomName === to.roomName) {
            return getLocalPath(fromRoom, from, to, options);
        }

        if(!Memory.cache.maps) {Memory.cache.maps = {}}

        pathTimer.start('remote');

        let data = new CachedData(Memory.cache.maps);

        let timer = new utils.NamedTimer();

        let myUser = utils.myUsername();

        let ret = PathFinder.search(from, options.targets || to, {
            maxOps: options.maxOps,
            plainCost: 2,
            swampCost:5,
            roomCallback(roomName) {

                if(!canMoveInRoom(roomName, options, myUser)) {
                    return false;
                }

                let matrix = generateCostMatrix(roomName, data, timer, options);

                timer.start('dynamic');

                if(options.roomCallback) {
                    options.roomCallback(roomName, matrix)
                }

                timer.stop('dynamic');

                return matrix;
            }
        });

        if(ret.incomplete && ret.path.length < 5) {
            console.log("INCOMPLETE PATH !!!", from, 'to', to, JSON.stringify(options), '::', JSON.stringify(ret));
        }

        pathTimer.stop('remote');

        if(options.visualize) {

            for (let step of ret.path) {
                let vis = new RoomVisual(step.roomName);
                vis.circle(step, {});
            }
        }

        return ret.path;
    },

    updateRoomCache: roomCache.updateRoomCache,
};

module.exports.getMultiRoomPath = profiler.registerFN(module.exports.getMultiRoomPath, 'maps.getMultiRoomPath');
getLocalPath = profiler.registerFN(getLocalPath, 'maps.getLocalPath');