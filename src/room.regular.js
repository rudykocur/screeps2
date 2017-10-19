var _ = require("lodash");
const utils = require('utils');
const flags = require('utils.flags');
const minds = require('mind');
const RoomPopulationMind = require('mind.room.population').RoomPopulationMind;
const room_architect = require('room.architect');
const room_remote = require('room.remote');
const room_labs = require('room.labs');
const threat = require('combat.threat');

const wrappers = require('room.wrappers');

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

        this.flags = _.filter(Game.flags, 'room', this.room);

        this.structures = _.filter(Game.structures, 'room', this.room);
        this.extensions = _.filter(this.structures, 'structureType', STRUCTURE_EXTENSION);
        this.spawns = _.filter(this.structures, 'structureType', STRUCTURE_SPAWN);
        this.containers = this.room.find(FIND_STRUCTURES).filter(s => s.structureType == STRUCTURE_CONTAINER);
        this.extractor = _.first(_.filter(this.structures, 'structureType', STRUCTURE_EXTRACTOR));
        this.mineral = _.first(this.room.find(FIND_MINERALS));
        this.sources = this.room.find(FIND_SOURCES);
        this.roads = _.filter(this.room.find(FIND_STRUCTURES), 'structureType', STRUCTURE_ROAD);
        this.links = this.structures.filter(s => s.structureType == STRUCTURE_LINK);

        let storageFlag = _.first(this.flags.filter(flags.isStorage));

        if(this.room.storage) {
            this.storage = new wrappers.StorageWrapper(this, this.room.storage, this.links);
        }
        else if(storageFlag) {
            this.storage = new wrappers.FlagStorageWrapper(this, storageFlag);
        }
        else {
            console.log('OMG NO LOGIC FOR STORAGE !!!');
        }

        this.meetingPoint = _.first(_.filter(this.flags, flags.isMeetingPoint));

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

        this.threat = new threat.ThreatAssesment(this.enemies);
        this.controller = new wrappers.ControllerWrapper(this, this.room.controller, this.links);

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

    getEnergyToTransfer() {
        return _.sum(this.droppedEnergy, 'amount') + _.sum(this.containers, c => c.store[RESOURCE_ENERGY]);
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

        if((this.towers.length < 1 || damageToSpawns > 1000)
            && this.threat.getCombatCreeps().length > 0 && !this.room.controller.safeMode) {

            console.log(this, 'Activating SAFE MODE!!!!');
            Game.notify(this + ': ATTACK. SAFE MODE ACTIVATED. Creeps: ' + JSON.stringify(this.enemies));

            this.room.controller.activateSafeMode();
        }

        this.jobManager.update(this);

        this.spawner.run();
        this.labs.run();
        this.remote.run();
        this.architect.run();
        this.storage.run();
    }

    getExtensionsClusters() {
        return this.flags.filter(flags.isExtensionCluster).map(f => new wrappers.ExtensionCluster(f.pos, this));
    }

    toString() {
        return `[RoomManager ${this.room}]`;
    }
}

module.exports = {
    RoomManager
};