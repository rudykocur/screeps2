var _ = require('lodash');
const fsm = require('fsm');
const utils = require('utils');

const STATE_IDLE = 'idle';
const STATE_REPAIR = 'repair';
const STATE_HEAL = 'heal';
const STATE_ATTACK = 'attack';

class TowerMind extends utils.Executable {
    /**
     *
     * @param {StructureTower} tower
     * @param roomManager
     */
    constructor(tower, roomManager) {
        super();

        //super(creep, roomManager);
        this.tower = tower;
        this.roomMgr = roomManager;

        Memory.towers = Memory.towers || {};
        Memory.towers[this.id] = Memory.towers[this.id] || {fsm: {}};

        this.fsm = new fsm.FiniteStateMachine({
            [STATE_IDLE]: {
                onTick: this.lookAround.bind(this)
            },
            [STATE_REPAIR]: {
                onTick: this.repairTarget.bind(this)
            },
            [STATE_HEAL]: {
                onTick: this.healCreep.bind(this)
            },
            [STATE_ATTACK]: {
                onTick: this.attackTarget.bind(this)
            },
        }, this.memory.fsm, STATE_IDLE);
    }

    get memory() {
        return Memory.towers[this.id];
    }

    get id() {
        return this.tower.id;
    }

    lookAround() {
        let enemy = this.tower.pos.findClosestByRange(this.roomMgr.enemiesInside);

        if(enemy) {
            this.fsm.enter(STATE_ATTACK, {enemyId: enemy.id});
            return;
        }

        let wounded = _.first(_.filter(Game.creeps, c => {
            if(c.room != this.roomMgr.room) {
                return false;
            }

            return c.hits < c.hitsMax;
        }));

        if(wounded) {
            this.fsm.enter(STATE_HEAL, {healId: wounded.id});
            return;
        }

        if(this.tower.energy < 500) {
            return;
        }

        let repairTarget = _.first(this.roomMgr.structures.filter(/**Structure*/struct => {
            if(struct.structureType == STRUCTURE_RAMPART ||struct.structureType == STRUCTURE_WALL) {
                return false;
            }

            return (struct.hits / struct.hitsMax) < 0.5;
        }));

        if(!repairTarget) {
            repairTarget = _.first(this.roomMgr.containers.filter(c => (c.hits/c.hitsMax) < 0.5));
        }

        if(!repairTarget) {
            repairTarget = _.first(this.roomMgr.roads.filter(road => {
                return (road.hits / road.hitsMax) < 0.5;
            }));
        }

        if(repairTarget) {
            this.fsm.enter(STATE_REPAIR, {repairId: repairTarget.id});
            return;
        }
    }

    repairTarget() {
        let target = Game.getObjectById(this.fsm.localState.repairId);

        if(!target) {
            this.fsm.enter(STATE_IDLE);
        }
        else {
            this.tower.repair(target);
            this.fsm.localState.repairCounter ++;
        }

        if(this.fsm.localState.repairCounter > 6) {
            this.fsm.enter(STATE_IDLE);
        }
    }

    healCreep() {
        let target = Game.getObjectById(this.fsm.localState.healId);

        if(!target || target.hits == target.hitsMax) {
            this.fsm.enter(STATE_IDLE);
        }

        this.tower.heal(target);
    }

    attackTarget() {
        let target = Game.getObjectById(this.fsm.localState.enemyId);

        if(!target) {
            this.fsm.enter(STATE_IDLE);
        }
        else {
            this.tower.attack(target);
        }

    }

    update() {
        this.fsm.run();
    }

    get needsEnergy() {
        return this.tower.energy < this.tower.energyCapacity - 150;
    }
}

module.exports = {
    TowerMind
};