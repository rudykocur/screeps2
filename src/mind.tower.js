const _ = require('lodash');
const fsm = require('fsm');

const STATE_IDLE = 'idle';
const STATE_REPAIR = 'repair';
const STATE_ATTACK = 'attack';

class TowerMind {
    /**
     *
     * @param {StructureTower} tower
     * @param roomManager
     */
    constructor(tower, roomManager) {
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
        let enemy = this.tower.pos.findClosestByRange(this.roomMgr.enemies);

        if(enemy) {
            this.fsm.enter(STATE_ATTACK, {enemyId: enemy.id});
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
        this.fsm.update();
    }

    get needsEnergy() {
        return this.tower.energy < 500;
    }
}

module.exports = {
    TowerMind
};