let MindBase = require('mind.common').MindBase;
let throttle = require('utils').throttle;

const STATE_REFILL = 'refill';
const STATE_UPGRADE = 'upgrade';
const STATE_IDLE = 'idle';

class UpgraderMind extends MindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            [STATE_REFILL]: {
                onEnter: () => this.pickEnergyTarget(),
                onTick: ()=> this.doRefill(),
            },
            [STATE_UPGRADE]: {
                onEnter: () => {},
                onTick: () => this.doUpgrade(),
            },
            [STATE_IDLE]: {
                onTick: () => throttle(5, () => this.doCheckStatus()),
            }
        };

        this.setStateMachine(fsm, STATE_REFILL);
    }

    doCheckStatus() {
        if(this.creep.room.energyAvailable < this.creep.room.energyCapacityAvailable) {
            return;
        }

        if(_.sum(this.creep.carry) > 0) {
            this.enterState(STATE_UPGRADE);
            return;
        }

        let test = this.room.getDroppedEnergy(this.creep.pos, this.creep.carryCapacity/2);

        if(test) {
            this.enterState(STATE_REFILL, {targetId: test.id});
        }
    }

    pickEnergyTarget() {
        let resources = this.creep.room.find(FIND_DROPPED_RESOURCES);
        let target = _.first(_.sortByOrder(resources, ['amount'], ['desc']));

        if(!target) {
            this.enterState(STATE_IDLE);
        }

        this.localState.targetId = target.id;
    }

    doRefill() {
        if(this.creep.room.energyAvailable < this.creep.room.energyCapacityAvailable) {
            this.enterState(STATE_IDLE);
            return;
        }

        let target = Game.getObjectById(this.localState.targetId);

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(target.pos.isNearTo(this.creep)) {
            this.creep.pickup(target);
            this.enterState(STATE_UPGRADE);
        }
        else {
            this.creep.moveTo(target);
        }
    }

    doUpgrade() {
        let target = this.creep.room.controller;

        if(target.pos.inRangeTo(this.creep, 3)) {
            this.creep.upgradeController(target);

            if(_.sum(this.creep.carry) < 1) {
                this.enterState(STATE_IDLE);
            }
        }
        else {
            this.creep.moveTo(target);
        }
    }
}

module.exports = {
    UpgraderMind
};