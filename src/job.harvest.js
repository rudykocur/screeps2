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
            }
        });

    }

    pickMiningPosition(state) {
        let source = Game.getObjectById(this.data.targetId);

        let container = _.first(source.pos.findInRange(this.workRoom.data.containers, 1));

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

        let pos = new RoomPosition(state.targetPos.x, state.targetPos.y, state.targetPos.roomName);

        if(state.exact) {
            if(this.creep.pos.isEqualTo(pos)) {
                this.fsm.enter(STATE.HARVEST, {containerId: state.containerId});
                return;
            }
        }
        else {
            if(this.creep.pos.isNearTo(pos)) {
                this.fsm.enter(STATE.HARVEST);
                return;
            }
        }

        this.creep.mover.moveByPath(() =>{
            return maps.getMultiRoomPath(this.creep.pos, pos, {});
        })
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
            let sourceWrapper = this.workRoom.sources[source.id];
            if(sourceWrapper) {
                this.handleSourceLink(sourceWrapper, this.workRoom.controller, this.workRoom.storage);
            }
        }

        if(state.containerId) {
            let container = Game.getObjectById(state.containerId);
            if(container && container.hits < container.hitsMax) {
                this.creep.repair(container);
            }
        }
    }

    /**
     * @param {SourceWrapper} source
     * @param {ControllerWrapper} controller
     * @param {StorageWrapper} storage
     */
    handleSourceLink(source, controller, storage) {
        if(_.sum(this.creep.carry) < this.creep.carryCapacity) {
            this.creep.withdraw(source.container, RESOURCE_ENERGY);
        }

        if(source.link) {
            let energyNeed = source.link.energyCapacity - source.link.energy;
            if(energyNeed > 0 && this.creep.carryMax) {
                this.creep.transfer(source.link, RESOURCE_ENERGY);
            }

            if(energyNeed === 0) {
                if(source.link.cooldown === 0) {
                    if(storage.link && storage.link.energy < storage.link.energyCapacity / 2) {
                        source.link.transferEnergy(storage.link.link);

                    }
                }
            }
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.data.sources.map((energy) => {
            return new HarvestJobDTO(energy);
        });
    }
}

class HarvestJobDTO extends job_common.JobDTO {
    /**
     * @param {Source} source
     */
    constructor(source) {
        super('harvest-'+source.id, JOB_TYPE, minds.available.harvester);

        this.targetId = source.id;
    }
}

module.exports = {
    getHandler() {return HarvestJobHandler},
    JOB_TYPE
};