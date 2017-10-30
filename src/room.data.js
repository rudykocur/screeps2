var _ = require('lodash');
const cache = require('utils.cache');

const profiler = require('profiler');

class RoomData extends cache.CachedData {
    constructor(manager, room, storageFlag) {
        super(_.defaults(manager.room.memory, {data: {}}).data);

        this.__allStructures = null;
        this.__myStructures = null;

        this.room = room;

        this.spawns = this.cachedObjCollection('spawns', 300,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_SPAWN));

        this.extensions = this.cachedObjCollection('extensions', 300,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_EXTENSION));

        this.containers = this.cachedObjCollection('containers', 300,
            () => this._allStructures.filter(s => s.structureType == STRUCTURE_CONTAINER));

        this.extractor = this.cachedObj('extractor', 1000,
            () => _.first(this._myStructures.filter(s => s.structureType == STRUCTURE_EXTRACTOR)));

        this.mineral = this.cachedObj('mineral', 1000,
            () => _.first(this.room.find(FIND_MINERALS)));

        this.sources = this.cachedObjCollection('sources', 1000,
            () => this.room.find(FIND_SOURCES));

        this.roads = this.cachedObjCollection('roads', 100,
            () => this._allStructures.filter(s => s.structureType == STRUCTURE_ROAD));

        this.ramparts = this.cachedObjCollection('ramparts', 100,
            () => this._allStructures.filter(s => s.structureType == STRUCTURE_RAMPART));

        this.walls = this.cachedObjCollection('walls', 100,
            () => this._allStructures.filter(s => s.structureType == STRUCTURE_WALL));

        this.links = this.cachedObjCollection('links', 300,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_LINK));

        this.towers = this.cachedObjCollection('towers', 300,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_TOWER));

        this.labs = this.cachedObjCollection('labs', 300,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_LAB));

        this.droppedEnergy = this.cachedObjCollection('resources', 5,
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

        this.allStructures = [].concat(this.spawns, this.extensions, this.links, this.towers);
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