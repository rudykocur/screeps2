var _ = require("lodash");
const utils = require('utils');
const cache = require('utils.cache');
const maps = require('maps');

const profiler = require('profiler');

class StructureWrapper extends utils.Executable {
    constructor(id) {
        super();

        this.structureId = id;

        this._initMemory();

        this.memory = Memory.structures[this.structureId];
    }

    _initMemory() {
        if(!('structures' in Memory)) {
            Memory.structures = {};
        }

        if(!(this.structureId in Memory.structures)) {
            Memory.structures[this.structureId] = {};
        }
    }
}

profiler.registerClass(StructureWrapper, StructureWrapper.name);

class FlagStorageWrapper extends utils.Executable {
    constructor(room, flag) {
        super();

        this.room = room;
        this.target = flag;
        this.resource =  _.first(this.target.pos.lookFor(LOOK_RESOURCES));
    }

    getStoredEnergy() {
        if(!this.resource) {
            return 0;
        }
        return this.resource.amount;
    }

    isNear(creep) {
        return this.target.pos.isNearTo(creep.pos);
    }

    canDeposit(creep) {
        return this.target.pos.isEqualTo(creep.pos);
    }

    deposit(fromCreep) {
        fromCreep.drop(RESOURCE_ENERGY);
    }

    withdraw(toCreep) {
        toCreep.pickup(this.resource);
    }
}

class StorageWrapper extends StructureWrapper {
    /**
     *
     * @param manager
     * @param {StructureStorage} storage
     * @param {Array<LinkWrapper>} links
     */
    constructor(manager, storage, links) {
        super(storage.id);

        this.manager = manager;
        this.target = storage;

        let data = new cache.CachedData(this.memory);

        let t1 = this.target.pos == null, t2 = _.isUndefined(this.target.pos);

        if(t1 || t2) {
            this.warn('POS IS BROKEN !!!', t1, '::', t2);

            let t3 = this.target.pos == null,t4 = _.isUndefined(this.target.pos);

            this.warn('SECOND CHECK !!!', t3, '::', t4);
            Game.notify(`POS BORKEN ${t1} :: ${t2} :: ${t3} :: ${t4}`);
        }

        if(!this.target.pos) {this.warn('WHY NO POS? 222', this.target);}
        // if(!this.target.pos) {this.warn('WHY NO POS?', this.target, '::', this.target.pos);}


        this.link = data.cachedObj('link', 500, () => {
            return _.first(this.target.pos.findInRange(links, 3));
        });

        this.link = _.first(this.target.pos.findInRange(links, 3));
    }

    getStoredEnergy() {
        return this.target.store[RESOURCE_ENERGY];
    }

    isNear(creep) {
        return this.target.pos.isNearTo(creep.pos);
    }

    canDeposit(creep) {
        return this.target.pos.isNearTo(creep.pos);
    }

    /**
     * @param {Creep} fromCreep
     */
    deposit(fromCreep) {
        return fromCreep.transfer(this.target, _.findKey(fromCreep.carry));
    }

    /**
     * @param {Creep} toCreep
     * @param resource
     * @param amount
     */
    withdraw(toCreep, resource, amount) {
        toCreep.withdraw(this.target, resource || RESOURCE_ENERGY, amount);
    }

    toString() {
        return `[StorageWrapper ${this.manager.roomName}]`;
    }
}

class ExtensionCluster extends StructureWrapper {
    /**
     * @param {Flag} flag
     * @param {RoomManager} manager
     * @param {RoomData} roomData
     */
    constructor(flag, manager, roomData) {
        super('extcluster-' + flag.pos.toString());

        this.id = 'extcluster-' + flag.pos.toString();

        this.center = flag.pos;

        this.initWrapper(manager, roomData);
    }

    initWrapper(manager, roomData) {
        let data = new cache.CachedData(this.memory);

        this.extensions = data.cachedObjCollection('extenions', 50, () => {
            return this.center.findInRange(roomData.extensions, 1);
        });

        this.extensionsMax = data.cachedValue('extensionsMax', 1000, () => {
            return this.countPlainsAround(this.center) - 1;
        });

        this.storagePos = manager.storage.target.pos;

        let capacity = this.extensions.length * EXTENSION_ENERGY_CAPACITY[manager.room.controller.level];
        let storedEnergy = _.sum(this.extensions, 'energy');

        this.needsEnergy = (storedEnergy < capacity);
        this.energyNeeded = capacity - storedEnergy;
    }

    get distanceToStorage() {
        return this.center.getRangeTo(this.storagePos);
    }

    /**
     * @param {RoomPosition} center
     */
    countPlainsAround(center) {
        let result = 0;
        let terrain = Game.map.getRoomTerrain(center.roomName);

        for(let pos of utils.getPositionsAround(center)) {
            if(terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                result += 1;
            }
        }

        return result;
    }
}

class LinkWrapper extends utils.Executable {
    constructor(link) {
        super();

        this.link = link;
        this.pos = link.pos;
        this.id = link.id;
        this.cooldown = link.cooldown;
        this.energy = link.energy;
        this.energyCapacity = link.energyCapacity;

        _.defaults(Memory, {structures: {}});
        _.defaults(Memory.structures, {[this.link.id]: {reservedUntill: 0}});
    }

    get memory() {
        return Memory.structures[this.link.id];
    }

    get reserved() {
        return this.memory.reservedUntill > 0;
    }

    transferEnergy(target, amount) {
        let result = this.link.transferEnergy(target.link || target, amount);

        if(result === OK) {
            this.memory.reservedUntill = 0;
        }

        return result;
    }

    reserve(duration) {
        if(this.memory.reservedUntill < Game.time) {
            this.memory.reservedUntill = Game.time + duration;
            return true;
        }

        return false;
    }

    update() {
        if(this.memory.reservedUntill > 0) {
            this.link.room.visual.circle(this.link.pos, {radius: 0.5, fill: 'green'})
        }

        if(this.memory.reservedUntill < Game.time) {
            this.memory.reservedUntill = 0;
        }
    }
}

class ControllerWrapper extends StructureWrapper {
    /**
     * @param manager
     * @param {StructureController} ctrl
     * @param links
     */
    constructor(manager, ctrl, links) {
        super(ctrl.id);

        this.controller = ctrl;
        this.manager = manager;

        this.initWrapper(manager, links);
    }

    initWrapper(manager, links) {
        let data = new cache.CachedData(this.memory);

        let pos = this.controller.pos;

        /**
         * @type {Array<RoomPosition>}
         */
        this.points = data.cachedPositions('points', 300, () => {
            let around = manager.room.lookAtArea(pos.y - 3, pos.x - 3, pos.y + 3, pos.x + 3, true);

            let points = around.filter(item => {

                if(item.type != LOOK_TERRAIN) {
                    return false;
                }

                if(item.terrain != 'plain' && item.terrain != 'swamp') {
                    return false;
                }

                if(pos.getRangeTo(item.x, item.y) < 2) {
                    return false;
                }

                return manager.room.lookForAt(LOOK_STRUCTURES, item.x, item.y).length === 0;
            }).map(item => RoomPosition.asPosition(item, manager.room.name));

            let sorted = _.sortBy(points, p => pos.getRangeTo(p)*-1);

            let nearRoad = sorted.filter(/**RoomPosition*/p => {
                let roads = p.findInRange(FIND_STRUCTURES, 1, {
                    filter: s => s.structureType === STRUCTURE_ROAD
                });

                return roads.length > 0;
            });

            let withoutRoads = sorted.filter(p => nearRoad.indexOf(p) < 0);

            return withoutRoads.concat(nearRoad);
        });

        this.points.slice(-10).forEach((point, i) => {
            this.manager.room.visual.circle(point);
            this.manager.room.visual.text(""+i, point, {color: 'white', stroke: 'black', font: 0.8});
        });

        this.link = data.cachedObj('link', 500, () => {
            return _.first(pos.findInRange(links, 4));
        });

        if(this.link) {
            this.manager.room.visual.line(this.controller.pos, this.link.pos, {});
        }
    }

    getLinkEnergy() {
        if(!this.link) {
            return 0;
        }

        return this.link.energy;
    }

    getNeededEnergyInLink() {
        if(!this.link) {
            return 0;
        }

        return this.link.energyCapacity - this.link.energy;
    }

    getStandingPosition() {
        return this.points.pop();
    }
}

class MineralWrapper extends StructureWrapper {
    constructor(mineral, extractor, containers) {
        super(mineral.id);

        this.mineral = mineral;
        this.extractor = extractor;
        this.pos = this.mineral.pos;

        this.initMineralWrapper(containers);
    }

    initMineralWrapper(containers) {
        let data = new cache.CachedData(this.memory);

        this.container = data.cachedObj('container', 100, () => {
            return _.first(this.pos.findInRange(containers, 1));
        });
    }

    pickContainerPlace() {
        let around = utils.getPositionsAround(this.pos);

        let terrain = Game.map.getRoomTerrain(this.pos.roomName);

        for(let point of around) {
            if(terrain.get(point.x, point.y) === TERRAIN_MASK_PLAIN) {
                let struct = point.lookFor(LOOK_STRUCTURES);

                if(struct.length > 0) {
                    continue;
                }

                let construction = _.first(point.lookFor(LOOK_CONSTRUCTION_SITES));
                if(construction && construction.structureType !== STRUCTURE_CONTAINER) {
                    continue;
                }

                return point;
            }
        }
    }
}

class MiningSite extends StructureWrapper {
    /**
     * @param {Source} source
     * @param containers
     * @param links
     * @param {StorageWrapper} storage
     * @param allDroppedEnergy
     */
    constructor(source, containers, links, storage, allDroppedEnergy) {
        super(source.id);

        this.source = source;
        this.storage = storage;

        this.initWrapper(containers, links, allDroppedEnergy);
    }

    initWrapper(containers, links, allDroppedEnergy) {
        let data = new cache.CachedData(this.memory);

        /**
         * @type StructureContainer
         */
        this.container = data.cachedObj('container', 100, () => {
            return _.first(this.source.pos.findInRange(containers, 1));
        });

        /**
         * @type StructureLink
         */
        this.link = data.cachedObj('link', 100, () => {
            return _.first(this.source.pos.findInRange(links, 2));
        });

        this.energy = this.source.pos.findInRange(allDroppedEnergy, 1);
        this.energyAmount = _.sum(this.energy.map(/**Resource*/r => r.amount));

        this.distanceToStorage = data.cachedValue('distanceToStorage', 1000, () => {
            return maps.getMultiRoomPath(this.storage.target.pos, this.source.pos).length;
        });

        this.storedEnergy = this.energyAmount + (this.container && this.container.store[RESOURCE_ENERGY] || 0);

        if(!this.link) {
            this.expectedEnergyIncrease = this.distanceToStorage * 2 * 5;
        }
        else {
            this.expectedEnergyIncrease = 0;
        }

        this.expectedEnergy = this.storedEnergy + this.expectedEnergyIncrease;
    }

    toString() {
        return `[MiningSite for ${this.source.id} in ${this.source.pos.roomName}]`;
    }
}

profiler.registerClass(FlagStorageWrapper, FlagStorageWrapper.name);
profiler.registerClass(StorageWrapper, StorageWrapper.name);
profiler.registerClass(ExtensionCluster, ExtensionCluster.name);
profiler.registerClass(ControllerWrapper, ControllerWrapper.name);
profiler.registerClass(LinkWrapper, LinkWrapper.name);
profiler.registerClass(MineralWrapper, MineralWrapper.name);
profiler.registerClass(MiningSite, MiningSite.name);

module.exports = {
    FlagStorageWrapper,
    StorageWrapper,
    ExtensionCluster,
    ControllerWrapper,
    LinkWrapper,
    MineralWrapper,
    MiningSite,
};