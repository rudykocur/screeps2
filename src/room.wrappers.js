var _ = require("lodash");
const utils = require('utils');
const cache = require('utils.cache');

const profiler = require('profiler');

class StructureWrapper extends utils.Executable {
    constructor(id) {
        super();

        this.structureId = id;

        _.defaults(Memory, {structures: {}});
        _.defaults(Memory.structures, {[this.structureId]: {}});
    }

    get memory() {
        return Memory.structures[this.structureId];
    }
}

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
        fromCreep.transfer(this.target, _.findKey(fromCreep.carry));
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

        _.defaults(this.memory, {extensions: []});

        this.id = 'extcluster-' + flag.pos.toString();

        this.center = flag.pos;

        this.initWrapper(manager, roomData);
    }

    initWrapper(manager, roomData) {
        this.extensions = this.getExtensions(roomData);
        this.extensionsMax = this.countPlainsAround(this.center) - 1;
        this.storagePos = manager.storage.target.pos;

        let capacity = _.size(this.extensions) * EXTENSION_ENERGY_CAPACITY[manager.room.controller.level];
        let storedEnergy = _.sum(this.extensions, 'energy');

        this.needsEnergy = (storedEnergy < capacity);
        this.energyNeeded = capacity - storedEnergy;

        let vis = new RoomVisual(this.center.roomName);
        vis.text(this.extensionsMax, this.center);
    }

    getExtensions(roomData) {
        let interval = 50;

        if(this.memory.extensions.length ===0 ) {
            interval = 5;
        }

        utils.every(interval, () => {
            this.memory.extensions = this.center.findInRange(roomData.extensions, 1).map(s => s.id);
        });

        return this.memory.extensions.map(sId => Game.getObjectById(sId));
    }

    get distanceToStorage() {
        return this.center.getRangeTo(this.storagePos);
    }

    /**
     * @param {RoomPosition} center
     */
    countPlainsAround(center) {
        let result = 0;
        for(let pos of utils.getPositionsAround(center)) {
            if(Game.map.getTerrainAt(pos) !== 'wall') {
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
    constructor(manager, ctrl, links) {
        super(ctrl.id);

        this.controller = ctrl;
        this.manager = manager;

        this.initWrapper(manager, links);
    }

    initWrapper(manager, links) {
        let data = new cache.CachedData(this.memory);

        let pos = this.controller.pos;

        this.points = data.cachedPositions('points', 300, () => {
            let around = manager.room.lookAtArea(pos.y - 3, pos.x - 3, pos.y + 3, pos.x + 3, true);

            let points = around.filter(item => {

                if(item.type != LOOK_TERRAIN) {
                    return false;
                }

                if(item.terrain != 'plain') {
                    return false;
                }

                if(pos.getRangeTo(item.x, item.y) < 2) {
                    return false;
                }

                return manager.room.lookForAt(LOOK_STRUCTURES, item.x, item.y).length === 0;
            }).map(item => new RoomPosition(item.x, item.y, manager.room.name));

            return _.sortBy(points, p => pos.getRangeTo(p)*-1);
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

        for(let point of around) {
            if(Game.map.getTerrainAt(point) == 'plain') {
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

class SourceWrapper extends StructureWrapper {
    constructor(source, containers, links) {
        super(source.id);

        this.source = source;

        this.initWrapper(containers, links);
    }

    initWrapper(containers, links) {
        let data = new cache.CachedData(this.memory);

        this.container = data.cachedObj('container', 100, () => {
            return _.first(this.source.pos.findInRange(containers, 1));
        });

        this.link = data.cachedObj('link', 100, () => {
            return _.first(this.source.pos.findInRange(links, 2));
        });
    }
}

profiler.registerClass(FlagStorageWrapper, FlagStorageWrapper.name);
profiler.registerClass(StorageWrapper, StorageWrapper.name);
profiler.registerClass(ExtensionCluster, ExtensionCluster.name);
profiler.registerClass(ControllerWrapper, ControllerWrapper.name);
profiler.registerClass(LinkWrapper, LinkWrapper.name);
profiler.registerClass(MineralWrapper, MineralWrapper.name);
profiler.registerClass(SourceWrapper, SourceWrapper.name);

module.exports = {
    FlagStorageWrapper,
    StorageWrapper,
    ExtensionCluster,
    ControllerWrapper,
    LinkWrapper,
    MineralWrapper,
    SourceWrapper,
};