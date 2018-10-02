var _ = require('lodash');
let mind = require('mind.common');
let throttle = require('utils').throttle;
const maps = require('maps');
let bb = require('utils.bodybuilder');

const profiler = require('profiler');

const STATE_REFILL = 'refill';
const STATE_BUILD = 'build';
const STATE_IDLE = 'idle';


/**
 * @typedef {Object} BuilderMindBuildState
 * @property {String} buildSiteId
 * @property {String} structureType
 * @property {String} posStr
 * @property {Boolean} [outOfRoad]
 */

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
                return this.enterState(STATE_REFILL);
            }

            if(this.workRoom.data.droppedEnergy.length > 0 || this.workRoom.data.containers.length > 0) {
                return this.enterState(STATE_REFILL);
            }
        }

        this.actions.gotoMeetingPoint();
    }

    pickRefillSource(state) {
        if(this.workRoom.storage && this.workRoom.storage.getStoredEnergy() > 3000) {
            return;
        }
        let target;

        if(this.creep.room != this.workRoom.room) {
            target = _.first(this.workRoom.data.droppedEnergy);

            if(!target) {
                target = _.first(this.workRoom.data.containers);
            }
        }
        else {
            target = this.creep.pos.findClosestByPath(this.workRoom.data.droppedEnergy);

            if(!target) {
                target = this.creep.pos.findClosestByPath(this.workRoom.data.containers, {
                    filter: /**StructureContainer*/cnt => cnt.store[RESOURCE_ENERGY] > 100
                });
            }
        }

        if(!target) {
            return this.enterState(STATE_IDLE);
        }

        state.refillId = target.id;
    }

    doRefill(state) {
        if(this.creep.carryMax) {
            return this.enterState(STATE_BUILD);
        }

        if(this.workRoom && this.workRoom.storage && this.workRoom.storage.getStoredEnergy() > 3000) {
            let minAmount = 600;
            if(this.workRoom.room.storage) {
                minAmount = 3000;
            }

            if(this.actions.isEnoughStoredEnergy(minAmount)) {
                this.actions.withdrawFromStorage(RESOURCE_ENERGY, {
                    onDone: () => this.enterState(STATE_BUILD)
                })
            }
            else {
                this.enterState(STATE_IDLE);
            }

            return;
        }

        let target = Game.getObjectById(state.refillId);

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        let result = this._doGetEnergy(target);

        if(result === OK) {
            return this.enterState(STATE_BUILD);
        }

        if(result === ERR_NOT_IN_RANGE) {
            this.creep.mover.moveByPath(target, () =>{
                return maps.getMultiRoomPath(this.creep.pos, target.pos, {
                    ignoreAllLairs: this.creep.workRoom.isSKRoom,
                });
            })
        }
        else {
            this.enterState(STATE_IDLE);
        }
    }

    _doGetEnergy(target) {
        if(target instanceof Resource) {
            return this.creep.pickup(target);
        }
        else if (target instanceof Structure) {
            return this.creep.withdraw(target, RESOURCE_ENERGY);
        }
    }

    pickBuildTarget(state) {
        /**
         * @type {ConstructionSite}
         */
        let site;

        if(this.creep.memory.reinforcer) {
            site = this._pickRampartOrWall();
        }
        else {
            site = this.creep.pos.findClosestByRange(this.workRoom.constructionSites);

            if(!site && this.workRoom.controller.controller.my) {
                site = this._pickRampartOrWall();
            }
        }

        if(!site) {
            return this.enterState(STATE_IDLE);
        }

        state.buildSiteId = site.id;
        state.structureType = site.structureType;
        state.posStr = site.pos.serialize();
    }

    _pickRampartOrWall() {
        let rampart = _.min(this.workRoom.data.ramparts, r => r.hits);
        let wall = _.min(this.workRoom.data.walls, r => r.hits);

        return _.min([rampart, wall], s => s.hits);
    }

    /**
     * @param {BuilderMindBuildState} state
     */
    doBuild(state) {
        let target = Game.getObjectById(state.buildSiteId);

        if(!target && state.structureType === STRUCTURE_RAMPART) {
            let pos = RoomPosition.unserialize(state.posStr);

            let target = _.first(pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART));

            if(target) {
                this.debug('Rampart constructed. Switching to it');
                state.buildSiteId = target.id;
                return;
            }
        }

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(target.pos.inRangeTo(this.creep, 3)) {
            if(!state.outOfRoad) {
                state.outOfRoad = this.actions.pickOffRoadPosition(target.pos, 3);
            }
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
            this.actions.moveTo(target);
        }

        this.creep.room.visual.line(this.creep.pos, target.pos, {})
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

profiler.registerClass(BuilderMind, BuilderMind.name);

module.exports = {
    BuilderMind
};