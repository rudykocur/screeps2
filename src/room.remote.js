var _ = require("lodash");
const minds = require('mind');
const utils = require('utils');

let mind_scout = require('mind.scout');
let mind_defender = require('mind.defender');
let mind_defender_ranged = require('mind.rangedDefender');
let mind_claimer = require('mind.claimer');

let squads = require('combat.squad');
let missions = require('combat.missions');

class RemoteRoomsManager extends utils.Executable {

    /**
     * @param {RoomManager} manager
     */
    constructor(manager) {
        super();

        this.manager = manager;
        this.jobManager = manager.jobManager;

        this.manager.room.memory.remoteRooms = this.manager.room.memory.remoteRooms || {};

        this.handlers = this.getHandlers();
    }

    get memory(){
        return this.manager.room.memory.remoteRooms;
    }

    getHandlers() {
        return (this.memory.roomNames || []).map(name => new RemoteRoomHandler(name, this.manager));
    }

    update() {
        for(let handler of this.handlers) {
            handler.prioritySpawn();
        }

        for(let handler of this.handlers) {
            handler.run();
        }

        this.memory.roomNames = this.getRemoteRoomNames();
    }

    getRemoteRoomNames() {
        let toCheck = this.getExitRooms(this.manager.room.name);

        let result = [];

        while(toCheck.length > 0) {
            let roomName = toCheck.pop();

            result.push(roomName);

            let newRooms = this.getExitRooms(roomName);

            toCheck = toCheck.concat(newRooms);
        }

        return result;
    }

    /**
     * @param roomName
     */
    getExitRooms(roomName) {
        let exitFlags = _.filter(Game.flags, /**Flag*/ f => {
            if(f.pos.roomName != roomName) {
                return;
            }

            return f.color == COLOR_PURPLE && f.secondaryColor == COLOR_PURPLE;
        });

        let availableExits = Game.map.describeExits(roomName);
        let exits = [];

        exitFlags.forEach(/**Flag*/ flag => {
            let exitDirection = this.getExitFlagDirection(flag);
            exits.push(availableExits[exitDirection]);
        });

        return exits;
    }

    /**
     * @param {Flag} flag
     */
    getExitFlagDirection(flag) {
        if(flag.pos.x === 0) {
            return LEFT;
        }
        if(flag.pos.y === 0) {
            return TOP;
        }
        if(flag.pos.x === 49) {
            return RIGHT;
        }
        if(flag.pos.y == 49) {
            return BOTTOM;
        }
    }

    toString() {
        return `[RemoteRoomsManager for ${this.manager.room}]`;
    }
}

class RemoteRoomHandler extends utils.Executable {
    /**
     * @param roomName
     * @param {RoomManager} parentManager
     */
    constructor(roomName, parentManager) {
        super();

        this.roomName = roomName;
        this.parent = parentManager;
        this.jobManager = parentManager.jobManager;

        this.isRemote = true;

        this.room = Game.rooms[this.roomName];

        if(!Memory.rooms[this.roomName]) {
            Memory.rooms[this.roomName] = {type: 'remote'};
        }

        _.defaults(this.memory, {
            squads: []
        });

        this.creeps = _.filter(Game.creeps, "memory.roomName", this.roomName);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));
        this.mindsByType = _.groupBy(this.minds, 'constructor.name');

        this.enemies = [];

        this.memory.squads.forEach(squadId => {
            let squad = squads.CombatSquad.getSquad(squadId);
            if(squad) {
                this.minds.push(squad);
            }
        });

        if(this.room) {
            this.room.manager = this;

            this.enemies = this.room.find(FIND_HOSTILE_CREEPS);
            this.sources = this.room.find(FIND_SOURCES);
            this.droppedEnergy = _.filter(this.room.find(FIND_DROPPED_RESOURCES), (res) => {
                if(res.resourceType != RESOURCE_ENERGY) {
                    return false;
                }

                return true;
            });
            this.spawns = [];
            this.extensions = [];
            this.extensionsClusters = [];
            this.towers = [];
            this.containers = this.room.find(FIND_STRUCTURES).filter(s => s.structureType == STRUCTURE_CONTAINER);
            this.constructionSites = _.filter(Game.constructionSites, 'room', this.room);
        }

        if(this.enemies.length > 0) {
            this.danger = this.enemies.filter(creep => {
                return creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0
            }).length > 0;
        }

        for(let name of ['scoutName', 'defenderName', 'claimerName']) {
            if(this.memory[name] && !Game.creeps[this.memory[name]]) {
                delete this.memory[name];
            }
        }
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
     * @return {RoomPopulationMind}
     */
    get spawner() {
        return this.parent.spawner;
    }

    prioritySpawn() {
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
            if (!this.memory.remoteStructures) {
                this.memory.remoteStructures = this.findRemoteStructures(this.room);
            }

            if (this.enemies.length === 0) {
                this.trySpawnClaimer();
            }

            if(this.enemies.length === 0) {
                if (this.getCreepCount(minds.available.harvester) < 2) {
                    this.spawnMind(minds.available.harvester);
                }
                else if (this.constructionSites.length > 0 && this.getCreepCount(minds.available.builder) < 2) {
                    this.spawnMind(minds.available.builder);
                }
                else if (this.droppedEnergy.length > 0 && this.getCreepCount(minds.available.transfer) < 2) {
                    this.spawnMind(minds.available.transfer);
                }
                else if (_.sum(this.droppedEnergy, 'amount') > 2000 &&
                    this.getSpawnCooldown(minds.available.transfer) > 200 &&
                    this.getCreepCount(minds.available.transfer) < 5) {
                    this.spawnMind(minds.available.transfer);
                }
            }

            this.jobManager.update(this);
        }

        for(let mind of this.minds) {
            mind.run();
        }
    }

    spawnMind(mind) {
        let spawn = this.spawner.getFreeSpawn();

        if(spawn) {
            return this.spawner.spawn(this, mind.getSpawnParams(this.parent));
        }
    }

    getSpawnCooldown(mind) {
        return this.spawner.getSpawnCooldown(`${this.room.name}-${mind.name}`);
    }

    trySpawnDefender() {
        if (!this.memory.defenderName) {
            let defenderName = this.spawnMind(minds.available.defender);
            if (defenderName) {
                this.memory.defenderName = defenderName;
                console.log(this, 'defender', defenderName, 'spawned')
            }
        }
    }

    trySpawnClaimer() {
        if(this.memory.claimerName) {
            return;
        }

        if(this.parent.room.energyCapacityAvailable < 700) {
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

    findRemoteStructures(room) {
        return {
            controller: {
                id: room.controller.id,
                pos: room.controller.pos
            },
            sources: _.map(room.find(FIND_SOURCES), src => {
                return {pos: src.pos, id: src.id}
            })
        }
    }



    toString() {
        return '[Remote handler for ' + (this.room || this.roomName) + ']';
    }
}

module.exports = {
    RemoteRoomsManager
};