var _ = require('lodash');
const cache = require('utils.cache');

class RoomData extends cache.CachedData {
    constructor(manager, room, storageFlag) {
        super(_.defaults(manager.room.memory, {data: {}}).data);

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

        this.links = this.cachedObjCollection('links', 300,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_LINK));

        this.towers = this.cachedObjCollection('towers', 300,
            () => this._myStructures.filter(s => s.structureType == STRUCTURE_TOWER));

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
    }

    get _myStructures() {
        return this.room.find(FIND_MY_STRUCTURES);
    }

    get _allStructures() {
        return this.room.find(FIND_STRUCTURES);
    }
}

module.exports = {
    RoomData
};