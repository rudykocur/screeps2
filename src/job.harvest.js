var _ = require('lodash');
const minds = require('mind');
const maps = require('maps');
const job_common = require('job.common');
const utils = require('utils');

const profiler = require('profiler');

const JOB_TYPE = 'harvest-source';

const STATE = {
    GOTO: 'goto',
    HARVEST: 'harvest',
    KEEP_DISTANCE: 'keep_distance',
};

class HarvestJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.GOTO, {
            [STATE.GOTO]: {
                onEnter: this.pickMiningPosition.bind(this),
                onTick: this.gotoSource.bind(this)
            },
            [STATE.HARVEST]: {
                onTick: this.harvestSource.bind(this)
            },
            [STATE.KEEP_DISTANCE]: {
                onEnter: this.pickSafeSpot.bind(this),
                onTick: this.stayInSafeSpot.bind(this),
            }
        });

    }

    pickMiningPosition(state) {
        let source = Game.getObjectById(this.data.targetId);

        let container = _.first(source.pos.findInRange(this.workRoom.data.containers, 1));
        let lair = _.first(source.pos.findInRange(this.workRoom.data.lairs, 5));

        if(lair) {
            state.lairId = lair.id;
        }

        if(container) {
            state.targetPos = container.pos;
            state.exact = true;
            state.containerId = container.id;
        }
        else {
            state.targetPos = source.pos;
            state.exact = false;
        }
    }

    gotoSource(state) {
        let source = Game.getObjectById(this.data.targetId);
        if(!source) {
            this.completeJob();
            return;
        }

        let pos = RoomPosition.asPosition(state.targetPos);

        if(state.exact) {
            if(this.creep.pos.isEqualTo(pos)) {
                this.fsm.enter(STATE.HARVEST, {containerId: state.containerId, lairId: state.lairId});
                return;
            }
        }
        else {
            if(this.creep.pos.isNearTo(pos)) {
                this.fsm.enter(STATE.HARVEST, {lairId: state.lairId});
                return;
            }
        }

        this.actions.moveTo(pos);
        // this.creep.mover.moveByPath(() =>{
        //     return maps.getMultiRoomPath(this.creep.pos, pos, {
        //         ignoreLairs: [state.lairId],
        //     });
        // });

        this.creep.room.visual.line(this.creep.pos, pos);
    }

    harvestSource(state) {
        let source = Game.getObjectById(this.data.targetId);

        if(!source) {
            this.completeJob();
            return;
        }

        if(!this.creep.pos.isNearTo(source)) {
            this.fsm.enter(STATE.GOTO);
            return;
        }

        this.creep.mover.enterStationary();
        this.creep.harvest(source);

        if(this.workRoom.sources) {
            let miningSite = this.workRoom.sources[source.id];
            if(miningSite) {
                this.handleSourceLink(miningSite, this.workRoom.controller, this.workRoom.storage);
            }
        }

        if(state.containerId) {
            let container = Game.getObjectById(state.containerId);
            if(container && container.hits < container.hitsMax) {
                this.creep.repair(container);
            }
        }

        if(state.lairId) {
            let lair = Game.getObjectById(state.lairId);
            if(lair && lair.ticksToSpawn < 15) {
                this.fsm.enter(STATE.KEEP_DISTANCE, {lairId: state.lairId});
            }
        }
    }

    /**
     * @param {MiningSite} miningSite
     * @param {ControllerWrapper} controller
     * @param {StorageWrapper} storage
     */
    handleSourceLink(miningSite, controller, storage) {
        if(_.sum(this.creep.carry) < this.creep.carryCapacity) {
            this.creep.withdraw(miningSite.container, RESOURCE_ENERGY);
        }

        if(miningSite.link) {
            let energyNeed = miningSite.link.energyCapacity - miningSite.link.energy;
            if(energyNeed > 0 && this.creep.carryMax) {
                this.creep.transfer(miningSite.link, RESOURCE_ENERGY);
            }

            if(energyNeed === 0) {
                if(miningSite.link.cooldown === 0) {
                    if(storage.link && storage.link.energy < storage.link.energyCapacity / 2) {
                        miningSite.link.transferEnergy(storage.link.link);
                    }
                }
            }
        }
    }

    pickSafeSpot(state) {
        let target = this.workRoom.parent.storage.target;

        let path = maps.getMultiRoomPath(this.creep.pos, target.pos, {
            ignoreLairs: [state.lairId],
        });

        let pos = _.last(path.slice(0, 10));

        state.pos = {
            x: pos.x,
            y: pos.y,
            roomName: pos.roomName,
        }
    }

    stayInSafeSpot(state) {
        let pos = RoomPosition.asPosition(state.pos);
        let lair = Game.getObjectById(state.lairId);

        if(!state.stationary && !this.creep.pos.isEqualTo(pos)) {
            this.creep.mover.moveTo(pos);
        }
        else {
            state.stationary = true;
            // if(!state.outOfRoad) {
            //     state.outOfRoad = this.actions.pickOffRoadPosition(lair, 10);
            // }
            let enemies = lair.pos.findInRange(this.creep.workRoom.threat.enemies, 5);
            if(lair.ticksToSpawn > 10 && enemies.length === 0) {
                this.fsm.enter(STATE.GOTO);
                return;
            }
            this.creep.mover.enterStationary();
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        let sources = manager.data.sources;

        if(manager.room.name === 'sim') {
            sources = _.filter(sources, /**Source*/s => s.pos.findInRange(FIND_HOSTILE_CREEPS, 6))
        }

        return sources.map((energy) => {
            return new HarvestJobDTO(energy);
        });
    }
}

class HarvestJobDTO extends job_common.JobDTO {
    /**
     * @param {Source} source
     */
    constructor(source) {
        let slots = Math.max(source.energyCapacity, 3000)/300/2;

        super('harvest-'+source.id, JOB_TYPE, minds.available.harvester, slots);

        this.targetId = source.id;
    }
}

module.exports = {
    getHandler() {return HarvestJobHandler},
    JOB_TYPE
};