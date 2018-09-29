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

const naming = require('utils.naming');

const wrappers = require('room.wrappers');
const profiler = require('profiler');

const procdef = require('process.roomDefence');

class RoomManager extends roombase.RoomBase {
    /**
     * @param {Room} room
     * @param {JobBoard} jobManager
     * @param {ProcessManager} procMgr
     */
    constructor(room, jobManager, procMgr) {
        super(room.name);

        this.initMemory();

        this.jobManager = jobManager;
        this.processManager = procMgr;
        this.isSupporting = false;

        this.initalizeRoom();

        this.remote = new remote_manager.RemoteRoomsManager(this);
    }

    initalizeRoom() {

        this.flags = this._getFlags();
        let storageFlag = this._getStorageFlag();

        this.data = this._getRoomData(storageFlag);

        this.links = this._getLinks();

        this.storage = this._getStorage(storageFlag);

        this.mineral = this._getMineral();

        this.sources = this.mines = this._getSources(this.data.sources);

        this.meetingPoint = this._getMeetingPoint();

        this.constructionSites = this._getConstructionSites();

        this.enemies = this._getEnemies();
        this.enemiesInside = this._getEnemiesInside(this.enemies);
        
        if(this.room.name === 'sim') {
            this.enemies = this.enemies.filter(/**Creep*/creep => creep.owner.username !== 'Source Keeper')
        }

        this.terminal = this.room.terminal;

        this.threat = this._getThreatAssesment(this.enemies);

        this.controller = this._getControllerWrapper();

        this.towers = this._getTowers(this.data.towers);

        this.extensionsClusters = this.getExtensionsClusters();

        this.architect = new room_architect.RoomArchitect(this);
        this.spawner = this._getSpawner();

        this.labs  = this._getLabManager();

        this.market = this._getMarket();

        this.stats = this._getRoomStats();

        if(!this.meetingPoint) {
            this.err('No meeting point! (green/green)');
        }

        if(!this.room.storage && !storageFlag) {
            this.err('No storage flag! (blue/blue)');
        }
    }

    initMemory() {
        if(!this.room.memory.lastSpawnTick) {
            this.room.memory.lastSpawnTick = {}
        }

        if(!this.room.memory.counter) {
            this.room.memory.counter = 0;
        }

        if(_.isUndefined(this.room.memory.nameQueue)) {
            this.room.memory.nameQueue = [];
        }

        _.defaultsDeep(this.room.memory, {stats: {avgEnergy: []}});
    }

    getNextCreepName() {
        if(!this.memory.queueLoop) {
            this.memory.queueLoop = 1;
        }

        if(this.memory.nameQueue.length === 0) {
            this.memory.nameQueue = _.shuffle(naming.getGroup(this.namingGroup).names);
            this.memory.queueLoop += 1;
            this.memory.queueLoop = this.memory.queueLoop % 5;
        }

        return {name: this.memory.nameQueue.shift(), index: this.memory.queueLoop};
    }

    getCreepName(name) {
        let data = this.getNextCreepName();

        return data.name + ': ' + name + data.index;
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
        return this._createClusters(this._getClustersFlags());
    }

    _getClustersFlags() {
        return this.flags.filter(flags.isExtensionCluster);
    }

    _createClusters(flags) {
        return flags.map(f => this._createCluster(f));
    }

    _createCluster(f) {
        return new wrappers.ExtensionCluster(f, this, this.data);
    }

    runDef() {
        this.processManager.addProcess(new procdef.RoomDefenceAnalysis(this.roomName, {roomName: this.roomName}));
    }

    _getFlags() {
        return _.filter(Game.flags, 'pos.roomName', this.roomName);
    }

    _getStorageFlag() {
        return _.first(this.flags.filter(flags.isStorage));
    }

    _getRoomData(storageFlag) {
        return new data.RoomData(this, this.room, storageFlag);
    }

    _getLinks() {
        return this.data.links.map(l => new wrappers.LinkWrapper(l));
    }

    _getStorage(storageFlag) {
        if(this.room.storage) {
            return new wrappers.StorageWrapper(this, this.room.storage, this.links);
        }
        else if(storageFlag) {
            return new wrappers.FlagStorageWrapper(this, storageFlag);
        }
        else {
            console.log('OMG NO LOGIC FOR STORAGE !!!');
        }
    }

    _getMineral() {
        if(this.room.controller.level > 5) {
            return new wrappers.MineralWrapper(this.data.mineral, this.data.extractor, this.data.containers);
        }

        return null;
    }

    /**
     *
     * @param sources
     * @return {Object<string, MiningSite>}
     * @private
     */
    _getSources(sources) {
        let result = {};
        sources.forEach((source) => {
            result[source.id] = new wrappers.MiningSite(source, this.data.containers, this.data.links);
        });

        return result;
    }

    _getMeetingPoint() {
        return _.first(_.filter(this.flags, flags.isMeetingPoint))
    }

    _getConstructionSites() {
        return _.filter(Game.constructionSites, 'room', this.room);
    }

    _getEnemies() {
        return this.room.find(FIND_HOSTILE_CREEPS);
    }

    _getEnemiesInside(enemies) {
        return enemies.filter(/**Creep*/creep => {
            return creep.pos.x > 1 && creep.pos.y > 1 && creep.pos.x < 48 && creep.pos.y < 48
        })
    }

    _getThreatAssesment(enemies) {
        return new threat.ThreatAssesment(enemies)
    }

    _getControllerWrapper() {
        return new wrappers.ControllerWrapper(this, this.room.controller, this.links);
    }

    _getTowers(towers) {
        return towers.map(tower => {
            let mind = new minds.available.tower(tower, this);
            this.minds.push(mind);
            return mind;
        })
    }

    _getSpawner() {
        return new population.RoomPopulation(this, this.extensionsClusters, this.data.spawns)
    }

    _getLabManager() {
        return new room_labs.LabManager(this, this.data.labs, this.terminal);
    }

    _getMarket() {
        return new market.RoomMarket(this, this.terminal, this.room.storage, this.labs);
    }

    _getRoomStats() {
        return new stats.RoomStats(this, this.labs);
    }

    toString() {
        return `[RoomManager ${this.getRoomTitle() || this.room}]`;
    }
}

profiler.registerClass(RoomManager, RoomManager.name);

module.exports = {
    RoomManager
};