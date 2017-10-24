var _ = require("lodash");
const utils = require('utils');

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

class StorageWrapper extends utils.Executable {
    /**
     *
     * @param manager
     * @param {StructureStorage} storage
     * @param {Array<LinkWrapper>} links
     */
    constructor(manager, storage, links) {
        super();

        this.manager = manager;
        this.target = storage;

        let t1 = this.target.pos == null, t2 = _.isUndefined(this.target.pos);

        if(t1 || t2) {
            this.warn('POS IS BROKEN !!!', t1, '::', t2);

            let t3 = this.target.pos == null,t4 = _.isUndefined(this.target.pos);

            this.warn('SECOND CHECK !!!', t3, '::', t4);
            Game.notify(`POS BORKEN ${t1} :: ${t2} :: ${t3} :: ${t4}`);
        }

        if(!this.target.pos) {this.warn('WHY NO POS? 222', this.target);}
        // if(!this.target.pos) {this.warn('WHY NO POS?', this.target, '::', this.target.pos);}

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
     */
    withdraw(toCreep) {
        toCreep.withdraw(this.target, RESOURCE_ENERGY);
    }

    toString() {
        return `[StorageWrapper ${this.manager.roomName}]`;
    }
}

class ExtensionCluster {
    /**
     * @param {RoomPosition} centerPoint
     * @param {RoomManager} manager
     * @param {RoomData} roomData
     */
    constructor(centerPoint, manager, roomData) {
        this.id = 'extcluster-' + centerPoint.toString();

        this.center = centerPoint;
        this.extensions = this.center.findInRange(roomData.extensions, 1);

        let capacity = _.size(this.extensions) * EXTENSION_ENERGY_CAPACITY[manager.room.controller.level];
        let storedEnergy = _.sum(this.extensions, 'energy');

        this.needsEnergy = (storedEnergy < capacity);
        this.energyNeeded = capacity - storedEnergy;
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

class ControllerWrapper {
    constructor(manager, ctrl, links) {
        this.controller = ctrl;
        this.manager = manager;

        let pos = this.controller.pos;

        let around = manager.room.lookAtArea(pos.y - 3, pos.x - 3, pos.y + 3, pos.x + 3, true);

        this.points = around.filter(item => {

            if(item.type != LOOK_TERRAIN) {
                return false;
            }

            if(item.terrain != 'plain') {
                return false;
            }

            return manager.room.lookForAt(LOOK_STRUCTURES, item.x, item.y).length === 0;
        }).map(item => new RoomPosition(item.x, item.y, manager.room.name));

        this.points = _.sortBy(this.points, p => pos.getRangeTo(p)*-1);

        this.link = _.first(pos.findInRange(links, 4));

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

module.exports = {
    FlagStorageWrapper,
    StorageWrapper,
    ExtensionCluster,
    ControllerWrapper,
    LinkWrapper,
};