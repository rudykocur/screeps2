let mind = require('mind.common');
let throttle = require('utils').throttle;
const bb = require('utils.bodybuilder');

const profiler = require('profiler');

const STATE_REFILL = 'refill';
const STATE_UPGRADE = 'upgrade';
const STATE_IDLE = 'idle';

class UpgraderMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            [STATE_REFILL]: {
                onEnter: this.pickRefillTarget.bind(this),
                onTick: this.doRefill.bind(this),
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
        let reservedEnergy = 500;
        if(this.roomMgr.room.storage) {
            reservedEnergy = 2000;
        }

        if(this.roomMgr.room.controller.ticksToDowngrade < 1000) {
            reservedEnergy = 0;
        }

        return (this.roomMgr.storage.getStoredEnergy() - reservedEnergy) > this.creep.carryCapacity/2;
    }

    pickRefillTarget(state) {
        if(this.workRoom.controller.getLinkEnergy() > 0) {
            state.source = 'link';
        }
    }

    doRefill(state) {
        if(!this.isEnoughStoredEnergy()) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(_.sum(this.creep.carry) > this.creep.carryCapacity/2) {
            this.enterState(STATE_UPGRADE);
            return;
        }

        if(state.source === 'link') {

            if(this.workRoom.controller.getLinkEnergy() === 0) {
                state.source = 'storage';
                return;
            }

            if(!this.creep.pos.isNearTo(this.workRoom.controller.link)) {
                this.actions.moveTo(this.workRoom.controller.link);
            }
            else {
                this.creep.withdraw(this.workRoom.controller.link, RESOURCE_ENERGY);
            }

            return;
        }

        if(this.roomMgr.storage.isNear(this.creep)) {
            this.roomMgr.storage.withdraw(this.creep);
            this.enterState(STATE_UPGRADE);
        }
        else {
            this.actions.moveTo(this.roomMgr.storage.target);
        }
    }

    doUpgrade() {
        let point = this.workRoom.controller.getStandingPosition(this.creep);

        let target = this.room.controller;

        if(_.sum(this.creep.carry) < 1) {
            this.enterState(STATE_IDLE);
        }

        let signText = this.workRoom.getRoomTitle();

        if(!target.sign || target.sign.text !== signText) {
            this.actions.moveTo(target);
            this.creep.signController(target, signText);
            return;
        }

        if(!this.creep.pos.isEqualTo(point)) {
            this.actions.moveTo(point, {visualizePathStyle: {}});
        }
        else {
            this.creep.mover.enterStationary();
        }

        this.creep.upgradeController(target);

        this.actions.repairRoad();
    }

    static getSpawnParams(manager) {
        let body = [MOVE, MOVE, CARRY, CARRY, WORK];

        if(manager.room.energyCapacityAvailable > 300) {
            body = bb.build([WORK, CARRY, MOVE], Math.min(manager.room.energyCapacityAvailable, 1700));
        }

        return {
            body: body,
            name: 'upgrader',
            memo: {mind: 'upgrader'}
        };
    }
}

profiler.registerClass(UpgraderMind, UpgraderMind.name);

module.exports = {
    UpgraderMind
};