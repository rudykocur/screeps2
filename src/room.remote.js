var _ = require("lodash");
const minds = require('mind');
const utils = require('utils');
const maps = require('maps');
const wrappers = require('room.wrappers');
const data = require('room.data');

let mind_scout = require('mind.scout');
let mind_defender = require('mind.defender');
let mind_defender_ranged = require('mind.rangedDefender');
let mind_claimer = require('mind.claimer');

let squads = require('combat.squad');
let missions = require('combat.missions');
let threat = require('combat.threat');

const profiler = require('profiler');

class RemoteRoomHandler extends utils.Executable {
    /**
     * @param roomName
     * @param {RoomManager} parentManager
     */
    constructor(roomName, parentManager) {
        super();
        this.stopwatch.start();
        this.timer.start();

        this.roomName = roomName;
        this.parent = parentManager;
        this.jobManager = parentManager.jobManager;

        this.isRemote = true;

        this.room = Game.rooms[this.roomName];

        if(!Memory.rooms[this.roomName]) {
            Memory.rooms[this.roomName] = {type: 'remote'};
        }

        this.stopwatch.lap('init');

        this.creeps = _.filter(Game.creeps, "memory.roomName", this.roomName);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));
        this.mindsByType = _.groupBy(this.minds, 'constructor.name');

        this.stopwatch.lap('creeps');

        this.enemies = [];

        if(this.room) {
            this.room.manager = this;
            this.controller = new wrappers.ControllerWrapper(this, this.room.controller);

            this.stopwatch.lap('controller');

            this.data = new data.RoomData(this, this.room);

            this.stopwatch.lap('room data');

            this.enemies = this.room.find(FIND_HOSTILE_CREEPS);

            this.stopwatch.lap('enemies');

            this.extensionsClusters = [];
            this.towers = [];
            this.constructionSites = _.filter(Game.constructionSites, 'room', this.room);

            this.stopwatch.lap('constructions');

            this.hostileStructures = this.room.find(FIND_HOSTILE_STRUCTURES)
                .filter(s => {
                    if(s.structureType === STRUCTURE_CONTROLLER) return false;
                    if(s.structureType === STRUCTURE_RAMPART) return false;
                    return true;
                });

            this.stopwatch.lap('hostile structrues');
        }

        this.threat = new threat.ThreatAssesment(this.enemies);

        this.stopwatch.lap('threat');

        for(let name of ['scoutName', 'defenderName', 'claimerName']) {
            if(this.memory[name] && !Game.creeps[this.memory[name]]) {
                delete this.memory[name];
            }
        }

        this.stopwatch.lap('cleanup');

        this.timer.stop();

        // this.warn('STOPWATCH');
        // this.stopwatch.print();
    }

    get memory() {
        return Memory.rooms[this.roomName];
    }

    getCreepCount(type) {
        if(!this.mindsByType[type.name]) {
            return 0;
        }

        return this.mindsByType[type.name].length;
    }

    /**
     *
     * @return {RoomPopulation}
     */
    get spawner() {
        return this.parent.spawner;
    }

    prioritySpawn() {
        this.timer.start();

        if(!this.room) {
            if(!this.memory.scoutName) {
                let name = this.spawnMind(mind_scout.ScoutMind);
                if (name) {
                    this.memory.scoutName = name;
                    console.log(this, 'Scout ', name, 'is sent');
                }
            }
        }
        else {
            if (this.enemies.length > 0) {
                this.trySpawnDefender();
            }
        }

        this.timer.stop();
    }

    update() {
        // console.log(this, 'updating ...');

        // if(this.memory.squads.length < 1) {
        //     let newSquad = squads.CombatSquad.createSquad();
        //     this.memory.squads.push(newSquad.squadId);
        //
        //     newSquad.addRequiredCreeps(this.parent, 3, mind_scout.ScoutMind.getSpawnParams(this.parent));
        //     newSquad.addRequiredCreeps(this.parent, 1, mind_defender.DefenderMind.getSpawnParams(this.parent));
        //
        //     newSquad.setMission(missions.DefendRoomMission.createMission(newSquad, this));
        //
        //     console.log('New squad added', newSquad);
        // }


        if(this.room) {
            this.timer.start();

            if (this.enemies.length === 0) {
                this.trySpawnClaimer();
            }

            if(this.canSpawnWorkers()) {
                if (this.getCreepCount(minds.available.harvester) < this.data.sources.length) {
                    this.spawnMind(minds.available.harvester);
                }
                else if (this.constructionSites.length > 0 && this.getCreepCount(minds.available.builder) < 2) {
                    this.spawnMind(minds.available.builder);
                }
                else if (this.data.droppedEnergy.length > 0 && this.getCreepCount(minds.available.transfer) < 2) {
                    this.spawnMind(minds.available.transfer);
                }
                else if (_.sum(this.data.droppedEnergy, 'amount') > 2000 &&
                    this.getSpawnCooldown(minds.available.transfer) > 200 &&
                    this.getCreepCount(minds.available.transfer) < 5) {
                    this.spawnMind(minds.available.transfer);
                }
            }
            this.timer.stop();

            this.jobManager.run(this);
        }

        // for(let mind of this.minds) {
        //     mind.run();
        // }
    }

    canSpawnWorkers() {
        if(this.room.controller.owner && this.room.controller.owner.username !== utils.myUsername()) {
            return false;
        }

        if(this.enemies.length > 0) {
            return false;
        }

        return true;
    }

    spawnMind(mind, options) {
        let spawn = this.spawner.getFreeSpawn();

        if(spawn) {
            return this.spawner.spawn(this, mind.getSpawnParams(this.parent, options));
        }
    }

    getSpawnCooldown(mind) {
        return this.spawner.getSpawnCooldown(`${this.room.name}-${mind.name}`);
    }

    trySpawnDefender() {

        maps.updateRoomCache(this.room, 0);

        let enemyCtrl = !!this.room.controller.owner && this.room.controller.owner.username !== 'rudykocur';

        if(enemyCtrl && this.shouldSpawnBreachCreep()) {
            this.spawnMind(minds.available.defender, {breach: enemyCtrl});
            return;
        }

        let defenders = this.getCreepCount(minds.available.defender) + this.getCreepCount(minds.available.rangedDefender);

        let requiredDefenders = 1;

        if(this.threat.getCombatCreeps().length > 0) {
            requiredDefenders = 2;
        }

        if(defenders < requiredDefenders) {
            let name;

            if(this.threat.rangedPower() > 3) {
                name = this.spawnMind(minds.available.rangedDefender);
            }
            else {
                name = this.spawnMind(minds.available.defender);
            }

            if(name) {
                this.warn('Created new defender', name);
            }
        }
    }

    shouldSpawnBreachCreep() {
        if(this.hostileStructures.length === 0) return false;
        if(this.threat.rangedPower() > 0) return false;
        if(this.getCreepCount(minds.available.defender) >= 2) return false;

        return true;
    }

    trySpawnClaimer() {
        if(this.memory.claimerName) {
            return;
        }

        if(this.parent.room.energyCapacityAvailable < 700) {
            return;
        }

        if(this.room.controller.upgradeBlocked > 50) {
            return;
        }

        if (!this.room.controller.reservation || this.room.controller.reservation.ticksToEnd < 1000) {
            let claimerName = this.spawnMind(mind_claimer.ClaimerMind);
            if (claimerName) {
                this.memory.claimerName = claimerName;
                console.log(this, 'claimer', claimerName, 'spawned');
            }
        }
    }

    toString() {
        return '[Remote handler for ' + (this.room || this.roomName) + ']';
    }
}

profiler.registerClass(RemoteRoomHandler, RemoteRoomHandler.name);

module.exports = {
    RemoteRoomHandler
};