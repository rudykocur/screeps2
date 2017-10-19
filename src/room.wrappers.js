var _ = require("lodash");

class FlagStorageWrapper {
    constructor(room, flag) {
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

class StorageWrapper {
    /**
     *
     * @param room
     * @param {StructureStorage} storage
     */
    constructor(room, storage) {
        this.room = room;
        this.target = storage;
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
}

class ExtensionCluster {
    /**
     * @param {RoomPosition} centerPoint
     * @param {RoomManager} manager
     */
    constructor(centerPoint, manager) {
        this.id = 'extcluster-' + centerPoint.toString();

        this.center = centerPoint;
        this.extensions = this.center.findInRange(manager.extensions, 1);

        let capacity = _.size(this.extensions) * EXTENSION_ENERGY_CAPACITY[manager.room.controller.level];
        let storedEnergy = _.sum(this.extensions, 'energy');

        this.needsEnergy = (storedEnergy < capacity);
        this.energyNeeded = capacity - storedEnergy;
    }
}

class ControllerWrapper {
    constructor(manager, ctrl) {
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
    }

    getStandingPosition() {
        return this.points.pop();
    }
}

module.exports = {
    FlagStorageWrapper,
    StorageWrapper,
    ExtensionCluster,
    ControllerWrapper
};