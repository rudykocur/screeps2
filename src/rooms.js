const _ = require("lodash");
const minds = require('mind');
const jobs = require('job.board');
const RoomPopulationMind = require('mind.room.population').RoomPopulationMind;

class RoomManager {
    constructor(room) {
        this.room = room;

        if(!this.room.memory.lastSpawnTick) {
            this.room.memory.lastSpawnTick = {}
        }

        this.jobs = new jobs.JobBoard(this);

        this.creeps = _.filter(Game.creeps, "room", this.room);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));

        this.minds.push(new RoomPopulationMind(this));

        this.mindsByType = _.groupBy(this.minds, 'constructor.name');

        if(Game.flags.STORAGE) {
            this.storage = new FlagStorageWrapper(this, Game.flags.STORAGE);
        }
        else {
            console.log('OMG NO LOGIC FOR STORAGE !!!');
        }

        this.meetingPoint = Game.flags.IDLE;

        this.constructionSites = _.filter(Game.constructionSites, 'room', this.room);
        this.droppedEnergy = _.filter(this.room.find(FIND_DROPPED_RESOURCES), (res) => {
            if(res.resourceType != RESOURCE_ENERGY) {
                return false;
            }

            return !res.pos.isEqualTo(this.storage.target.pos);
        });

        this.enemies = this.room.find(FIND_HOSTILE_CREEPS);
        this.structures = _.filter(Game.structures, 'room', this.room);
        this.extensions = _.filter(this.structures, 'structureType', STRUCTURE_EXTENSION);

        let towers = _.filter(Game.structures, (struct) => {
            if(struct.room != this.room) {
                return false;
            }

            return struct.structureType == STRUCTURE_TOWER;
        });

        this.towers = [];

        this.towers = towers.map(tower => {
            let mind = new minds.available.tower(tower, this);
            this.minds.push(mind);
            return mind;
        });

        this.extensionsClusters = this.getExtensionsClusters();
    }

    getCreepName(name) {
        return 'creep_'+(this.room.memory.counter++) + '_' + name;
    }

    getCreepCount(type) {
        if(!this.mindsByType[type.name]) {
            return 0;
        }

        return this.mindsByType[type.name].length;
    }

    getMinds(type) {
        return this.mindsByType[type.name];
    }

    getFreeEnergySource() {
        let usedSources = this.getMinds(minds.available.harvester).map(mind => {
            return mind.getHarvestTarget();
        });

        let sources = this.room.find(FIND_SOURCES, {
            filter: (src) => {
                return usedSources.indexOf(src.id) < 0;
            }
        });

        return _.first(sources);
    }

    getDroppedEnergy(sourcePos, minAmount) {
        minAmount = minAmount || 0;

        return sourcePos.findClosestByPath(this.droppedEnergy, {
            filter: (res) => res.amount > minAmount
        });
    }

    update() {
        if(this.towers.length < 1 && this.enemies.length > 0 && !this.room.controller.safeMode) {
            console.log('Activating SAFE MODE!!!!');
            Game.notify('ATTACK. SAFE MODE ACTIVATED');
            this.room.controller.activateSafeMode();
        }

        this.jobs.update();
    }

    getExtensionsClusters() {
        let flags = _.filter(Game.flags, /**Flag*/ flag => {
            return flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW;
        });

        return flags.map(f => new ExtensionCluster(f.pos, this));
    }
}

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
    }
}

module.exports = {
    RoomManager: RoomManager
};