var _ = require("lodash");
const utils = require('utils');
const flags = require('utils.flags');
const minds = require('mind');
const population = require('room.population');
const room_architect = require('room.architect');
const room_remote = require('room.remote');
const room_labs = require('room.labs');
const threat = require('combat.threat');
const data = require('room.data');
const stats = require('room.stats');
const market = require('room.market');

const wrappers = require('room.wrappers');

class RoomManager extends utils.Executable {
    /**
     * @param {Room} room
     * @param jobManager
     */
    constructor(room, jobManager) {
        super();

        this.timer.start();

        this.room = room;
        this.roomName = room.name;
        room.manager = this;

        this.initMemory();

        this.jobManager = jobManager;

        this.creeps = _.filter(Game.creeps, "memory.roomName", this.room.name);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));

        this.mindsByType = _.groupBy(this.minds, 'constructor.name');

        this.flags = _.filter(Game.flags, 'pos.roomName', this.roomName);
        let storageFlag = _.first(this.flags.filter(flags.isStorage));

        this.data = new data.RoomData(this, this.room, storageFlag);

        this.links = this.data.links.map(l => new wrappers.LinkWrapper(l));

        if(this.room.storage) {
            this.storage = new wrappers.StorageWrapper(this, this.room.storage, this.links);
        }
        else if(storageFlag) {
            this.storage = new wrappers.FlagStorageWrapper(this, storageFlag);
        }
        else {
            console.log('OMG NO LOGIC FOR STORAGE !!!');
        }

        this.mineral = null;
        if(this.room.controller.level > 5) {
            this.mineral = new wrappers.MineralWrapper(this.data.mineral, this.data.extractor, this.data.containers);
        }

        this.sources = _.transform(this.data.sources, (result, source) => {
            result[source.id] = new wrappers.SourceWrapper(source, this.data.containers, this.data.links);
        });

        this.meetingPoint = _.first(_.filter(this.flags, flags.isMeetingPoint));

        this.constructionSites = _.filter(Game.constructionSites, 'room', this.room);

        this.enemies = this.room.find(FIND_HOSTILE_CREEPS);
        this.enemiesInside = this.enemies.filter(/**Creep*/creep => {
            return creep.pos.x > 1 && creep.pos.y > 1 && creep.pos.x < 48 && creep.pos.y < 48
        });

        this.terminal = this.room.terminal;
        this.market = new market.RoomMarket(this, this.terminal);

        this.threat = new threat.ThreatAssesment(this.enemies);
        this.controller = new wrappers.ControllerWrapper(this, this.room.controller, this.links);


        this.towers = this.data.towers.map(tower => {
            let mind = new minds.available.tower(tower, this);
            this.minds.push(mind);
            return mind;
        });

        this.extensionsClusters = this.getExtensionsClusters();

        this.architect = new room_architect.RoomArchitect(this);
        this.spawner = new population.RoomPopulation(this, this.extensionsClusters, this.data.spawns);
        this.labs  = new room_labs.LabManager(this, this.data.labs, this.terminal);
        this.timer.stop();

        this.remote = new room_remote.RemoteRoomsManager(this);
        this.stats = new stats.RoomStats(this, this.labs);
    }

    initMemory() {
        if(!this.room.memory.lastSpawnTick) {
            this.room.memory.lastSpawnTick = {}
        }

        if(!this.room.memory.counter) {
            this.room.memory.counter = 0;
        }

        _.defaultsDeep(this.room.memory, {stats: {avgEnergy: []}});
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

    getAvgEnergyToPickup() {
        return _.sum(this.room.memory.stats.avgEnergy) / this.room.memory.stats.avgEnergy.length;
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

    update() {
        this.timer.count(()=> {

            let damageToSpawns = _.sum(this.data.spawns, /**StructureSpawn*/spawn => {
                return spawn.hitsMax - spawn.hits;
            });

            if ((this.towers.length < 1 || damageToSpawns > 1000)
                && this.threat.getCombatCreeps().length > 0 && !this.room.controller.safeMode) {

                this.room.controller.activateSafeMode();

                console.log(this, 'Activating SAFE MODE!!!!');
                Game.notify(this + ': ATTACK. SAFE MODE ACTIVATED. Creeps: ' + JSON.stringify(this.enemies));


            }

        });
        this.jobManager.run(this);

        this.timer.count(()=> {
            this.spawner.run();
            this.labs.run();
        });

        this.remote.run();

        this.timer.count(()=> {
            this.market.run();
            this.architect.run();
            this.storage.run();
            this.links.forEach(link => {
                link.run();
            });


            this.stats.run();
        });
    }

    getExtensionsClusters() {
        return this.flags.filter(flags.isExtensionCluster).map(
            f => new wrappers.ExtensionCluster(f.pos, this, this.data));
    }

    toString() {
        return `[RoomManager ${this.room}]`;
    }
}

module.exports = {
    RoomManager
};