let mind = require('mind.common');
let throttle = require('utils').throttle;

const STATE_REFILL = 'refill';
const STATE_BUILD = 'build';
const STATE_IDLE = 'idle';

class BuilderMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            [STATE_REFILL]: {
                onEnter: this.pickRefillSource.bind(this),
                onTick: this.doRefill.bind(this),
            },
            [STATE_BUILD]: {
                onEnter: this.pickBuildTarget.bind(this),
                onTick: this.doBuild.bind(this),
            },
            [STATE_IDLE]: {
                onTick: this.doCheckStatus.bind(this),
            }
        };

        this.setStateMachine(fsm, STATE_IDLE);
    }

    doCheckStatus() {
        if(_.sum(this.creep.carry) > 0) {

            if(this.workRoom.constructionSites.length > 0) {
                this.enterState(STATE_BUILD);
                return;
            }
        }

        if(_.sum(this.creep.carry) < this.creep.carryCapacity) {
            if(this.workRoom.storage && this.actions.isEnoughStoredEnergy(1000)) {
                this.enterState(STATE_REFILL);
                return;
            }

            if(this.workRoom.droppedEnergy.length > 0) {
                this.enterState(STATE_REFILL);
                return;
            }
        }

        this.actions.gotoMeetingPoint();
    }

    pickRefillSource() {
        if(this.workRoom.storage) {
            return;
        }
        let target;

        if(this.creep.room != this.workRoom.room) {
            target = _.first(this.workRoom.droppedEnergy);
        }
        else {
            target = this.creep.pos.findClosestByPath(this.workRoom.droppedEnergy);
        }

        this.localState.refillId = target.id;
    }

    doRefill() {
        if(this.workRoom.storage) {
            this.actions.refillFromStorage(STATE_BUILD, STATE_IDLE, 600);
            return;
        }

        let target = Game.getObjectById(this.localState.refillId);

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.moveTo(target);
        }
        else {
            this.creep.pickup(target);
            this.enterState(STATE_BUILD);
        }
    }

    pickBuildTarget() {
        let site = this.creep.pos.findClosestByRange(this.workRoom.constructionSites);

        if(!site) {
            this.enterState(STATE_IDLE);
            return;
        }

        this.localState.buildSiteId = site.id;
    }

    doBuild() {
        let target = Game.getObjectById(this.localState.buildSiteId);

        if(!target) {
            this.enterState(STATE_REFILL);
            return;
        }

        if(target.pos.inRangeTo(this.creep, 3)) {
            this.creep.build(target);

            if(_.sum(this.creep.carry) < 1) {
                this.enterState(STATE_REFILL);
            }
        }
        else {
            this.creep.repair(_.first(this.creep.pos.lookFor(LOOK_STRUCTURES)));
            this.creep.moveTo(target);
        }
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager) {
        let body = [MOVE, MOVE, CARRY, CARRY, WORK];
        if(manager.room.energyCapacityAvailable > 600) {
            body = [MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, WORK, WORK, WORK];
        }
        if(manager.room.energyCapacityAvailable > 1000) {
            body = [WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, WORK, MOVE, WORK, CARRY, MOVE];
        }

        return {
            body: body,
            name: 'builder',
            memo: {'mind': 'builder'}
        };
    }
}

module.exports = {
    BuilderMind
};