var _ = require('lodash');
const cache = require('utils.cache');

const profiler = require('profiler');

class RoomData extends cache.CachedData {
    constructor(manager, room, storageFlag) {
        super(_.defaults(manager.room.memory, {data: {}}).data);

        this.__allStructures = null;
        this.__myStructures = null;

        this.room = room;

        this.loadData(storageFlag);
    }

    loadData(storageFlag) {

        this.spawns = this.cachedObjCollection('spawns', 307,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_SPAWN));

        this.extensions = this.cachedObjCollection('extensions', 311,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_EXTENSION));

        this.containers = this.cachedObjCollection('containers', 313,
            () => this._allStructures.filter(s => s.structureType == STRUCTURE_CONTAINER));

        this.extractor = this.cachedObj('extractor', 1000,
            () => _.first(this._myStructures.filter(s => s.structureType == STRUCTURE_EXTRACTOR)));

        this.mineral = this.cachedObj('mineral', 6047,
            () => _.first(this.room.find(FIND_MINERALS)));

        this.sources = this.cachedObjCollection('sources', 5273,
            () => this.room.find(FIND_SOURCES));

        this._roads = null;
        this._ramparts = null;

        this.walls = this.cachedObjCollection('walls', 100,
            () => this._allStructures.filter(s => s.structureType == STRUCTURE_WALL));

        this.links = this.cachedObjCollection('links', 523,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_LINK));

        this.towers = this.cachedObjCollection('towers', 337,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_TOWER));

        this.labs = this.cachedObjCollection('labs', 571,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_LAB));

        this.lairs = this.cachedObjCollection('lairs', 5501,
            () => this._allStructures.filter(s => s.structureType == STRUCTURE_KEEPER_LAIR));

        this.droppedEnergy = this.getDroppedEnergy(storageFlag);

        this.tombstones = this.room.find(FIND_TOMBSTONES);
    }

    get roads() {
        if(!this._roads) {
            this._roads = this.cachedObjCollection('roads', 127,
                () => this._allStructures.filter(s => s.structureType == STRUCTURE_ROAD));
        }

        return this._roads;
    }

    get ramparts() {
        if(!this._ramparts) {
            this._ramparts = this.cachedObjCollection('ramparts', 109,
                () => this._allStructures.filter(s => s.structureType == STRUCTURE_RAMPART));
        }

        return this._ramparts;
    }

    getDroppedEnergy(storageFlag) {
        return this.cachedObjCollection('resources', 1,
            () => _.filter(this.room.find(FIND_DROPPED_RESOURCES), (res) => {
                if(res.resourceType != RESOURCE_ENERGY) {
                    return false;
                }

                if(!this.room.storage && storageFlag) {
                    return !res.pos.isEqualTo(storageFlag.pos);
                }

                return true;
            })
        );
    }

    get _myStructures() {
        if(this.__myStructures === null) {
            this.__myStructures = this.room.find(FIND_MY_STRUCTURES);
        }
        return this.__myStructures;
    }

    get _allStructures() {
        if(this.__allStructures === null) {
            this.__allStructures = this.room.find(FIND_STRUCTURES);
        }
        return this.__allStructures;
    }
}

profiler.registerClass(RoomData, RoomData.name);

module.exports = {
    RoomData
};