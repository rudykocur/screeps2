var _ = require("lodash");
const utils = require('utils');
const minds = require('mind');
const jobs = require('job.board');
const RoomPopulationMind = require('mind.room.population').RoomPopulationMind;
const room_architect = require('room.architect');
const room_remote = require('room.remote');
const room_labs = require('room.labs');

class RoomManager extends utils.Executable {
    /**
     * @param {Room} room
     * @param jobManager
     */
    constructor(room, jobManager) {
        super();

        this.room = room;
        this.roomName = room.name;
        room.manager = this;

        this.initMemory();

        this.jobManager = jobManager;

        this.creeps = _.filter(Game.creeps, "memory.roomName", this.room.name);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));

        this.mindsByType = _.groupBy(this.minds, 'constructor.name');

        if(this.room.storage) {
            this.storage = new StorageWrapper(this, this.room.storage);
        }
        else if(Game.flags.STORAGE) {
            this.storage = new FlagStorageWrapper(this, Game.flags.STORAGE);
        }
        else {
            console.log('OMG NO LOGIC FOR STORAGE !!!');
        }

        this.controller = new ControllerWrapper(this, this.room.controller);

        this.meetingPoint = Game.flags.IDLE;
        this.flags = _.filter(Game.flags, 'room', this.room);

        this.constructionSites = _.filter(Game.constructionSites, 'room', this.room);
        this.droppedEnergy = _.filter(this.room.find(FIND_DROPPED_RESOURCES), (res) => {
            if(res.resourceType != RESOURCE_ENERGY) {
                return false;
            }

            if(!this.room.storage) {
                return !res.pos.isEqualTo(this.storage.target.pos);
            }

            return true;
        });

        this.enemies = this.room.find(FIND_HOSTILE_CREEPS);
        this.enemiesInside = this.enemies.filter(/**Creep*/creep => {
            return creep.pos.x > 1 && creep.pos.y > 1 && creep.pos.x < 48 && creep.pos.y < 48
        });

        this.terminal = this.room.terminal;
        this.structures = _.filter(Game.structures, 'room', this.room);
        this.extensions = _.filter(this.structures, 'structureType', STRUCTURE_EXTENSION);
        this.spawns = _.filter(this.structures, 'structureType', STRUCTURE_SPAWN);
        this.containers = this.room.find(FIND_STRUCTURES).filter(s => s.structureType == STRUCTURE_CONTAINER);
        this.extractor = _.first(_.filter(this.structures, 'structureType', STRUCTURE_EXTRACTOR));
        this.mineral = _.first(this.room.find(FIND_MINERALS));
        this.sources = this.room.find(FIND_SOURCES);
        this.roads = _.filter(this.room.find(FIND_STRUCTURES), 'structureType', STRUCTURE_ROAD);

        let towers = _.filter(this.structures, 'structureType', STRUCTURE_TOWER);

        this.towers = towers.map(tower => {
            let mind = new minds.available.tower(tower, this);
            this.minds.push(mind);
            return mind;
        });

        this.extensionsClusters = this.getExtensionsClusters();

        this.architect = new room_architect.RoomArchitect(this);
        this.remote = new room_remote.RemoteRoomsManager(this);
        this.spawner = new RoomPopulationMind(this);
        this.labs  = new room_labs.LabManager(this);
    }

    initMemory() {
        if(!this.room.memory.lastSpawnTick) {
            this.room.memory.lastSpawnTick = {}
        }

        if(!this.room.memory.counter) {
            this.room.memory.counter = 0;
        }
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
        let damageToSpawns = _.sum(this.spawns, /**StructureSpawn*/spawn => {
            return spawn.hitsMax - spawn.hits;
        });

        if((this.towers.length < 1 || damageToSpawns > 1000) && this.enemies.length > 0 && !this.room.controller.safeMode) {
            console.log('Activating SAFE MODE!!!!');
            Game.notify('ATTACK. SAFE MODE ACTIVATED');
            this.room.controller.activateSafeMode();
        }

        this.jobManager.update(this);

        this.spawner.run();
        this.labs.run();
        this.remote.run();
        this.architect.run();
    }

    getExtensionsClusters() {
        let flags = this.flags.filter(utils.isExtensionClusterFlag);

        return flags.map(f => new ExtensionCluster(f.pos, this));
    }

    toString() {
        return `[RoomManager ${this.room}]`;
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
    }

    getStandingPosition() {
        return this.points.pop();
    }
}

module.exports = {
    RoomManager
};