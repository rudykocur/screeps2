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
                onEnter: () => {},
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
        if(_.sum(this.creep.carry) > 0) {
            this.enterState(STATE_UPGRADE);
            return;
        }

        if(this.isEnoughStoredEnergy()) {
            this.enterState(STATE_REFILL);
            return;
        }

        this.actions.gotoMeetingPoint();
    }

    isEnoughStoredEnergy() {
        return this.room.storage.getStoredEnergy() > this.creep.carryCapacity/2;
    }

    doRefill() {
        if(!this.isEnoughStoredEnergy()) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(this.room.storage.isNear(this.creep)) {
            this.room.storage.withdraw(this.creep);
            this.doCheckStatus();
        }
        else {
            this.creep.moveTo(this.room.storage.target);
        }
    }

    doUpgrade() {
        let target = this.creep.room.controller;

        if(target.pos.inRangeTo(this.creep, 3)) {
            this.creep.upgradeController(target);

            if(_.sum(this.creep.carry) < 1) {
                this.doCheckStatus();
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