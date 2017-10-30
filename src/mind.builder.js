var _ = require('lodash');
let mind = require('mind.common');
let throttle = require('utils').throttle;
let bb = require('utils.bodybuilder');

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
        if(!this.workRoom) {
            return;
        }

        if(_.sum(this.creep.carry) > 0) {

            if(this.workRoom.constructionSites.length > 0) {
                this.enterState(STATE_BUILD);
                return;
            }
        }

        if(_.sum(this.creep.carry) < this.creep.carryCapacity) {
            if(this.workRoom.storage && this.actions.isEnoughStoredEnergy(500)) {
                this.enterState(STATE_REFILL);
                return;
            }

            if(!this.workRoom.storage && this.workRoom.data.droppedEnergy.length > 0) {
                this.enterState(STATE_REFILL);
                return;
            }
        }

        this.actions.gotoMeetingPoint();
    }

    pickRefillSource(state) {
        if(this.workRoom.storage) {
            return;
        }
        let target;

        if(this.creep.room != this.workRoom.room) {
            target = _.first(this.workRoom.data.droppedEnergy);
        }
        else {
            target = this.creep.pos.findClosestByPath(this.workRoom.data.droppedEnergy);
        }

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        state.refillId = target.id;
    }

    doRefill(state) {
        if(this.workRoom.storage) {
            if(this.workRoom.room.storage) {
                this.actions.refillFromStorage(STATE_BUILD, STATE_IDLE, 1500);
            }
            else {
                this.actions.refillFromStorage(STATE_BUILD, STATE_IDLE, 600);
            }
            return;
        }

        let target = Game.getObjectById(state.refillId);

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.mover.moveTo(target);
        }
        else {
            this.creep.pickup(target);
            this.enterState(STATE_BUILD);
        }
    }

    pickBuildTarget(state) {
        let site;

        if(this.creep.memory.reinforcer) {
            site = this._pickRampartOrWall();
        }
        else {
            site = this.creep.pos.findClosestByRange(this.workRoom.constructionSites);

            if(!site) {
                site = this._pickRampartOrWall();
            }
        }

        if(!site) {
            this.enterState(STATE_IDLE);
            return;
        }

        state.buildSiteId = site.id;
    }

    _pickRampartOrWall() {
        let rampart = _.min(this.workRoom.data.ramparts, r => r.hits);
        let wall = _.min(this.workRoom.data.walls, r => r.hits);

        return _.min([rampart, wall], s => s.hits);
    }

    doBuild(state) {
        let target = Game.getObjectById(state.buildSiteId);

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(target.pos.inRangeTo(this.creep, 3)) {
            this.creep.mover.enterStationary();

            if(target instanceof ConstructionSite) {
                this.creep.build(target);
            }
            else {
                this.creep.repair(target);
            }

            if(_.sum(this.creep.carry) < 1) {
                this.enterState(STATE_REFILL);
            }
        }
        else {
            this.creep.repair(_.first(this.creep.pos.lookFor(LOOK_STRUCTURES)));
            this.creep.mover.moveTo(target);
        }
    }

    /**
     * @param {RoomManager} manager
     * @param {Object} [options]
     */
    static getSpawnParams(manager, options) {
        options = _.defaults(options || {}, {reinforcer: false});

        let body = [MOVE, MOVE, CARRY, CARRY, WORK];
        if(manager.room.energyCapacityAvailable > 600) {
            body = bb.build([CARRY, WORK, MOVE], 600);
        }
        if(manager.room.energyCapacityAvailable > 1000) {
            body = bb.build([CARRY, WORK, MOVE], 1000);
        }
        if(manager.room.energyCapacityAvailable > 2000) {
            body = bb.build([CARRY, WORK, MOVE], 1600);
        }


        return {
            body: body,
            name: options.reinforcer? 'reinforcer': 'builder',
            memo: {
                mind: 'builder',
                reinforcer: options.reinforcer,

            }
        };
    }
}

module.exports = {
    BuilderMind
};