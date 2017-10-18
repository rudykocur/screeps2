let mind = require('mind.common');
let throttle = require('utils').throttle;
const bb = require('utils.bodybuilder');

const STATE_REFILL = 'refill';
const STATE_UPGRADE = 'upgrade';
const STATE_IDLE = 'idle';

class UpgraderMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            [STATE_REFILL]: {
                onEnter: () => {},
                onTick: ()=> this.doRefill(),
            },
            [STATE_UPGRADE]: {
                onEnter: () => {},
                onTick: this.doUpgrade.bind(this),
            },
            [STATE_IDLE]: {
                onTick: this.doCheckStatus.bind(this),
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
        let reservedEnergy = 700;
        if(this.roomMgr.room.storage) {
            reservedEnergy = 1000;
        }

        if(this.roomMgr.room.controller.ticksToDowngrade < 1000) {
            reservedEnergy = 0;
        }

        return (this.roomMgr.storage.getStoredEnergy() - reservedEnergy) > this.creep.carryCapacity/2;
    }

    doRefill() {
        if(!this.isEnoughStoredEnergy()) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(this.roomMgr.storage.isNear(this.creep)) {
            this.roomMgr.storage.withdraw(this.creep);
            this.enterState(STATE_UPGRADE);
        }
        else {
            this.creep.mover.moveTo(this.roomMgr.storage.target);
        }
    }

    doUpgrade() {
        let point = this.workRoom.controller.getStandingPosition();

        let target = this.room.controller;

        if(_.sum(this.creep.carry) < 1) {
            this.enterState(STATE_IDLE);
        }

        if(!this.creep.pos.isEqualTo(point)) {
            this.creep.mover.moveTo(point, {visualizePathStyle: {}});
        }
        else {
            this.creep.mover.enterStationary();
        }

        this.creep.upgradeController(target);
    }

    static getSpawnParams(manager) {
        let body = [MOVE, MOVE, CARRY, CARRY, WORK];

        if(manager.room.energyCapacityAvailable > 600) {
            body = bb.build([WORK, CARRY, MOVE], 600);
        }

        if(manager.room.energyCapacityAvailable > 1000) {
            body = bb.build([WORK, CARRY, MOVE], 1000);
        }

        if(manager.room.energyCapacityAvailable > 1700) {
            body = bb.build([WORK, CARRY, MOVE], 1700);
        }

        return {
            body: body,
            name: 'upgrader',
            memo: {mind: 'upgrader'}
        };
    }
}

module.exports = {
    UpgraderMind
};