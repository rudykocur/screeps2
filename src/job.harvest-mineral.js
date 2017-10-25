var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'harvest-mineral';

const STATE = {
    GOTO: 'goto',
    HARVEST: 'harvest',
};

class HarvestExtractorJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.GOTO, {
            [STATE.GOTO]: {
                onEnter: this.pickMiningSpot.bind(this),
                onTick: this.gotoMineral.bind(this)
            },
            [STATE.HARVEST]: {
                onTick: this.harvestSource.bind(this)
            }
        });

    }

    pickMiningSpot(state) {
        let mineral = Game.getObjectById(this.data.mineralId);

        let container = _.first(mineral.pos.findInRange(this.workRoom.data.containers, 1));

        state.containerPos = container.pos;
        state.containerId = container.id;
    }

    gotoMineral(state) {
        let target = Game.getObjectById(state.containerId);

        if(!this.creep.pos.isEqualTo(target)) {
            this.creep.mover.moveTo(target, {visualizePathStyle: {}});
        }
        else {
            this.fsm.enter(STATE.HARVEST, {containerId: this.fsm.localState.containerId});
        }
    }

    harvestSource(state) {
        let mineral = Game.getObjectById(this.data.mineralId);
        let container = Game.getObjectById(state.containerId);

        if(_.sum(container.store) + 100 > container.storeCapacity) {
            return;
        }

        this.creep.mover.enterStationary();
        this.creep.harvest(mineral);
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        if(manager.data.extractor) {
            return [new HarvestMineralJobDTO(manager.data.mineral)];
        }

        return [];
    }
}

class HarvestMineralJobDTO extends job_common.JobDTO {
    /**
     * @param {Mineral} mineral
     */
    constructor(mineral) {
        super('mineral-'+mineral.id, JOB_TYPE, minds.available.harvester);

        this.mineralId = mineral.id;
    }
}

module.exports = {
    getHandler() {return HarvestExtractorJobHandler},
    JOB_TYPE
};