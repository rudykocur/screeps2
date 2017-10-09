const _ = require("lodash");
const minds = require('mind');
let mind_scout = require('mind.scout');
let mind_defender = require('mind.defender');
let mind_defender_ranged = require('mind.rangedDefender');
let mind_claimer = require('mind.claimer');

let squads = require('combat.squad');
let missions = require('combat.missions');

class RemoteRoomsManager {

    /**
     * @param {RoomManager} manager
     */
    constructor(manager) {
        this.manager = manager;

        this.manager.room.memory.remoteRooms = this.manager.room.memory.remoteRooms || {};
    }

    get memory(){
        return this.manager.room.memory.remoteRooms;
    }

    getHandlers() {
        return (this.memory.roomNames || []).map(name => new RemoteRoomHandler(name, this.manager));
    }

    update() {
        for(let handler of this.getHandlers()) {
            handler.update();
        }

        this.memory.roomNames = this.getRemoteRoomNames();
    }

    getRemoteRoomNames() {
        let rooms = this.getExitRooms(this.manager.room);
        // console.log('Enabled exits: ', rooms);
        return rooms;
    }

    /**
     * @param {Room} room
     */
    getExitRooms(room) {
        let exitFlags = _.filter(Game.flags, /**Flag*/ f => {
            if(f.room != room) {
                return;
            }

            return f.color == COLOR_PURPLE && f.secondaryColor == COLOR_PURPLE;
        });

        let availableExits = Game.map.describeExits(room.name);
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
        if(flat.pos.y == 49) {
            return BOTTOM;
        }
    }
}

class RemoteRoomHandler {
    /**
     * @param roomName
     * @param {RoomManager} parentManager
     */
    constructor(roomName, parentManager) {
        this.roomName = roomName;
        this.parent = parentManager;

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

    update() {
        // console.log(this, 'updating ...');

        if(this.memory.squads.length < 1) {
            let newSquad = squads.CombatSquad.createSquad();
            this.memory.squads.push(newSquad.squadId);

            newSquad.addRequiredCreeps(this.parent, 3, mind_scout.ScoutMind.getSpawnParams(this.parent, this.roomName));
            newSquad.addRequiredCreeps(this.parent, 1, mind_defender.DefenderMind.getSpawnParams(this.parent, this.roomName));

            newSquad.setMission(missions.DefendRoomMission.createMission(newSquad, this));

            console.log('New squad added', newSquad);
        }

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
            if (!this.memory.remoteStructures) {
                this.memory.remoteStructures = this.findRemoteStructures(this.room);
            }

            if (this.enemies.length > 0) {
                this.trySpawnDefender();
            }

            if (this.enemies.length === 0) {
                this.trySpawnClaimer();
            }
        }

        for(let mind of this.minds) {
            mind.update();
        }
    }

    spawnMind(mind) {
        let spawn = this.parent.spawner.getFreeSpawn();

        if(spawn) {
            return this.parent.spawner.spawn(this, mind.getSpawnParams(this.parent, this.roomName));
        }
    }

    trySpawnDefender() {
        if (!this.memory.defenderName) {
            let defenderName = this.spawnMind(mind_defender_ranged.RangedDefenderMind);
            if (defenderName) {
                this.memory.defenderName = defenderName;
                console.log(this, 'defender', defenderName, 'sent')
            }
        }
    }

    trySpawnClaimer() {
        if (!this.memory.claimerName && (!this.room.controller.reservation || this.room.controller.reservation.ticksToEnd < 1000)) {
            let claimerName = this.spawnMind(mind_claimer.ClaimerMind);
            if (claimerName) {
                this.memory.claimerName = claimerName;
                console.log(this, 'claimer', claimerName, 'sent');
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