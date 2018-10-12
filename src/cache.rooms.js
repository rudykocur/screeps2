var _ = require('lodash');
const utils = require('utils');
// const CachedData = require('utils.cache').CachedData;
const lz = require('lz-string');

const profiler = require('profiler');

let cacheInitTimer = new utils.NamedTimer(['other', 'load', 'pathfinding']);

function hydrate(item) {
    if(_.isString(item.pos)) {
        item.pos = RoomPosition.unserialize(item.pos);
    }
    else {
        item.pos = RoomPosition.asPosition(item.pos);
    }
    return item;
}

function getCacheForRoom(roomName) {
    if(!Memory.cache) {
        Memory.cache = {}
    }

    _.defaults(Memory.cache, {rooms: {}});

    Memory.cache.rooms[roomName] = (Memory.cache.rooms[roomName] || {});

    // _.defaults(Memory.cache.rooms[roomName], {roomName: roomName, dataZIP: null, lastUpdateTime: 0});
    _.defaults(Memory.cache.rooms[roomName], {roomName: roomName, dataJSON: '[]', lastUpdateTime: 0});

    return Memory.cache.rooms[roomName];
}

function hasCacheForRoom(roomName) {
    return !!_.get(Memory, ['cache', 'rooms', roomName]);
}

class HeapRoomsCache extends utils.Executable {
    constructor() {
        super();

        this.info('Cache reset');

        this.loadedRooms = {};
    }

    get(roomName) {
        let data = getCacheForRoom(roomName);

        let needToLoad = false;

        if(!(roomName in this.loadedRooms)) {
            needToLoad = true;
        }
        else {
            let loadedData = this.loadedRooms[roomName];

            if(loadedData.lastUpdateTime !== data.lastUpdateTime) {
                needToLoad = true;
            }
        }

        if(needToLoad) {
            cacheInitTimer.start('load');

            this.loadedRooms[roomName] = {
                data: JSON.parse(lz.decompressFromUTF16(data.dataZIP)).map(hydrate),
                lastUpdateTime: data.lastUpdateTime,
            };

            cacheInitTimer.stop('load');
        }

        return this.loadedRooms[roomName].data;
    }

    toString() {
        return '[HeapRoomsCache]';
    }
}

let heapCache = new HeapRoomsCache();

class CachedRoom {
    constructor(roomName) {
        this.name = roomName;

        this.initCache(roomName);
    }

    initCache(roomName) {
        let roomData = heapCache.get(roomName);

        this.cache = getCacheForRoom(roomName);
        this.cache.lastAccessTime = Game.time;

        // this.cacheData = JSON.parse(this.cache.dataJSON);
        // this.cacheData = this.cacheData.map(hydrate);
        this.cacheData = roomData;
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

    isSKRoom() {
        let coords = utils.parseRoomName(this.name);

        let x = coords.x % 10;
        let y = coords.y % 10;

        return x >= 4 && x <= 6 && y >= 4 && y <= 6;
    }

    get controller() {
        return this.getStructure(STRUCTURE_CONTROLLER);
    }

    getSafeModeUntill() {
        return this.cache.safeModeUntill;
}

    find(type) {
        return this.cacheData.filter(obj => obj._typeId === type || (!obj._typeId && type === FIND_STRUCTURES));
    }

    findStructures(structType) {
        return _.filter(this.cacheData, 'structureType', structType);
    }

    getStructure(structType) {
        return _.first(this.findStructures(structType));
    }

    toString() {
        return `[CachedRoom ${this.name}]`;
    }
}

/**
 * @param roomName
 * @return {CachedRoom}
 */
function getRoomCache(roomName, isPathfinding) {
    return tickCache.get('maps-roomCache-'+roomName, () => {
        if(!hasCacheForRoom(roomName)) {
            return null;
        }

        let timerName = isPathfinding ? 'pathfinding' : 'other';
        cacheInitTimer.start(timerName);
        let res = new CachedRoom(roomName);
        cacheInitTimer.stop(timerName);
        return res;
    });
}

/**
 * @param {Room} room
 */
function scanRoom(room) {
    let result = [];

    room.find(FIND_STRUCTURES).forEach(/**Structure*/struct => {
        let attrs = ['pos', 'structureType', 'id'];

        if(struct.structureType === STRUCTURE_RAMPART) {
            attrs.push('my');
            attrs.push('isPublic');
        }

        let obj = _.pick(struct, attrs);
        obj._typeId = FIND_STRUCTURES;
        obj.pos = obj.pos.serialize();
        result.push(obj);
    });

    for(let type of [FIND_SOURCES, FIND_MINERALS]) {
        room.find(type).forEach(src => {
            let obj = _.pick(src, ['pos', 'id']);
            obj._typeId = type;
            obj.pos = obj.pos.serialize();
            result.push(obj);
        });
    }

    return result;
}

getRoomCache = profiler.registerFN(getRoomCache, 'cache.rooms.getRoomCache');
profiler.registerClass(CachedRoom, CachedRoom.name);

module.exports = {
    getRoomCache,
    hasCacheForRoom,
    getCacheForRoom,
    // scanRoom,

    updateRoomCache(room, ttl) {
        ttl = ttl || 0;

        let cache = getCacheForRoom(room.name);
        let currentTTL = Game.time - cache.lastUpdateTime;

        if(currentTTL > ttl) {

            let timer = new utils.Timer().start();

            // cache.dataJSON = JSON.stringify(scanRoom(room));
            // cache.dataZIP = lz.compressToUTF16(cache.dataJSON);
            cache.dataZIP = lz.compressToUTF16(JSON.stringify(scanRoom(room)));
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

            if(ttl > 0) {
                let roomName = room.manager && room.manager.getRoomLink() || utils.getRoomLink(room.name, room.name);
                console.log(`[maps] updated cache for room ${roomName} in ${timer.stop()}`);
            }
        }
    },

    cacheInitTimer,
};