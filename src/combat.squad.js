var _ = require('lodash');
const fsm = require('fsm');
const missions = require('combat.missions');

const STATE = {
    SPAWNING: 'spawning',
    GATHERING: 'gathering',
    MISSION: 'on-mission',
};

class CombatSquad {
    constructor(squadId) {
        this.squadId = squadId;

        _.defaults(this.memory, {
            members: [],
            toSpawn: [],
            fsm: {},
            mission: null,
        });

        this.fsm = new fsm.FiniteStateMachine({
            [STATE.SPAWNING]: {
                onTick: this.spawnMembers.bind(this),
            },
            [STATE.GATHERING]: {
                onTick: this.gatherOnDepartureSpot.bind(this),
            },
            [STATE.MISSION]: {
                onTick: this.doMission.bind(this),
            },

        }, this.memory.fsm, STATE.SPAWNING);
    }

    static getSquad(id) {
        if(!Memory.squads[id]) {
            return;
        }

        return new CombatSquad(id);
    }

    static createSquad() {
        let squadId = Memory.counters.squad++;
        Memory.squads = Memory.squads || {};
        Memory.squads[squadId] = {};

        return new CombatSquad(squadId);
    }

    get memory() {
        return Memory.squads[this.squadId];
    }

    addRequiredCreeps(manager, amount, spawnOptions) {
        this.memory.toSpawn.push({
            amount: amount,
            spawnOptions: spawnOptions,
            spawnRoom: manager.room.name
        })
    }

    setMission(mission) {
        this.memory.mission = mission.TYPE;
    }

    update() {
        if(this.fsm.state && this.fsm.state != STATE.SPAWNING) {
            this.checkAliveMembers();

            if(this.memory.members.length < 1) {
                console.log(this, 'dead!!', this.fsm.state);
                delete Memory.squads[this.squadId];
                return;
            }
        }



        this.fsm.update();
    }

    checkAliveMembers() {
        let members = [];
        for(let name of this.memory.members) {
            if(Game.creeps[name]) {
                members.push(name);
            }
            else {
                console.log(this, "We've got man down:", name);
            }
        }
        this.memory.members = members;
    }

    spawnMembers() {
        if(this.memory.toSpawn.length < 1) {
            this.fsm.enter(STATE.GATHERING);
            console.log(this, 'All spawned, proceeding to gather');
            return;
        }

        let spawnGroup = this.memory.toSpawn[0];

        let manager = Game.rooms[spawnGroup.spawnRoom].manager;
        let name = manager.spawner.spawn(manager, spawnGroup.spawnOptions);
        if(name) {
            this.memory.members.push(name);
            spawnGroup.amount --;

            console.log(this, 'Spawned next member', name);
        }

        if(spawnGroup.amount < 1) {
            this.memory.toSpawn.splice(0, 1);
        }

        // console.log('Try spawning ....')
    }

    gatherOnDepartureSpot() {
        // console.log(this, 'gathering ....')
    }

    doMission() {
        console.log(this, 'missioning ...')
    }

    toString() {
        return `[CombatSquad id=${this.squadId}]`;
    }
}

module.exports = {
    CombatSquad
};