var _ = require("lodash");
const utils = require('utils');
const flags = require('utils.flags');
const minds = require('mind');
const population = require('room.population');
const room_architect = require('room.architect');
const remote_manager = require('room.remote-manager');
const room_labs = require('room.labs');
const threat = require('combat.threat');
const data = require('room.data');
const stats = require('room.stats');
const market = require('room.market');
const roombase = require('room.base');

const wrappers = require('room.wrappers');
const profiler = require('profiler');

const procdef = require('process.roomDefence');

class RoomManager extends roombase.RoomBase {
    /**
     * @param {Room} room
     * @param jobManager
     * @param {ProcessManager} procMgr
     */
    constructor(room, jobManager, procMgr) {
        super(room.name);

        this.timer.start();

        this.initMemory();

        this.jobManager = jobManager;
        this.processManager = procMgr;
        this.isSupporting = false;

        this.initalizeRoom();
    }

    initalizeRoom() {

        this.stopwatch.start();

        this.flags = _.filter(Game.flags, 'pos.roomName', this.roomName);
        let storageFlag = _.first(this.flags.filter(flags.isStorage));

        this.stopwatch.lap('flags');

        this.data = new data.RoomData(this, this.room, storageFlag);

        this.stopwatch.lap('room data');

        this.links = this.data.links.map(l => new wrappers.LinkWrapper(l));

        this.stopwatch.lap('links');

        if(this.room.storage) {
            this.storage = new wrappers.StorageWrapper(this, this.room.storage, this.links);
        }
        else if(storageFlag) {
            this.storage = new wrappers.FlagStorageWrapper(this, storageFlag);
        }
        else {
            console.log('OMG NO LOGIC FOR STORAGE !!!');
        }

        this.stopwatch.lap('storage');

        this.mineral = null;
        if(this.room.controller.level > 5) {
            this.mineral = new wrappers.MineralWrapper(this.data.mineral, this.data.extractor, this.data.containers);
        }

        this.stopwatch.lap('mineral');

        this.sources = {};
        this.data.sources.forEach((source) => {
            this.sources[source.id] = new wrappers.SourceWrapper(source, this.data.containers, this.data.links);
        });

        this.stopwatch.lap('sources');

        this.meetingPoint = _.first(_.filter(this.flags, flags.isMeetingPoint));

        this.constructionSites = _.filter(Game.constructionSites, 'room', this.room);

        this.stopwatch.lap('construction sites');

        this.enemies = this.room.find(FIND_HOSTILE_CREEPS);
        this.enemiesInside = this.enemies.filter(/**Creep*/creep => {
            return creep.pos.x > 1 && creep.pos.y > 1 && creep.pos.x < 48 && creep.pos.y < 48
        });

        this.stopwatch.lap('enemies');

        this.terminal = this.room.terminal;

        this.threat = new threat.ThreatAssesment(this.enemies);

        this.stopwatch.lap('threat');

        this.controller = new wrappers.ControllerWrapper(this, this.room.controller, this.links);

        this.stopwatch.lap('controller');

        this.towers = this.data.towers.map(tower => {
            let mind = new minds.available.tower(tower, this);
            this.minds.push(mind);
            return mind;
        });

        this.stopwatch.lap('towers');

        this.extensionsClusters = this.getExtensionsClusters();

        this.stopwatch.lap('extensions');

        this.architect = new room_architect.RoomArchitect(this);
        this.spawner = new population.RoomPopulation(this, this.extensionsClusters, this.data.spawns);

        this.stopwatch.lap('spawner');

        this.labs  = new room_labs.LabManager(this, this.data.labs, this.terminal);

        this.stopwatch.lap('labs');

        this.market = new market.RoomMarket(this, this.terminal, this.room.storage, this.labs);
        this.timer.stop();

        this.remote = new remote_manager.RemoteRoomsManager(this);
        this.stopwatch.lap('remote');
        this.stats = new stats.RoomStats(this, this.labs);
        this.stopwatch.lap('stats');

        // this.warn('STOPWATCH');
        // this.stopwatch.print();
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

    getAllMinds() {
        return this.minds.concat(this.remote.getAllMinds());
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

    setSupporting(supportedRoom) {
        this.isSupporting = true;
    }

    update(exchange) {
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
            this.labs.run(exchange);
        });

        this.remote.run();

        this.timer.count(()=> {
            this.market.run(exchange);
            this.architect.run();
            this.storage.run();
            this.links.forEach(link => {
                link.run();
            });


            this.stats.run();
        });

        if(!this.isSupporting) {
            this.labs.unloadBoosts();
        }
    }

    getExtensionsClusters() {
        return this.flags.filter(flags.isExtensionCluster).map(
            f => new wrappers.ExtensionCluster(f, this, this.data));
    }

    runDef() {
        this.processManager.addProcess(new procdef.RoomDefenceAnalysis(this.roomName, {roomName: this.roomName}));
    }

    toString() {
        return `[RoomManager ${this.room}]`;
    }
}

profiler.registerClass(RoomManager, RoomManager.name);

module.exports = {
    RoomManager
};