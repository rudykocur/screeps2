const minds = require('mind');
const job_common = require('job.common');

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
                onTick: this.gotoSource.bind(this)
            },
            [STATE.HARVEST]: {
                onTick: this.harvestSource.bind(this)
            }
        });

    }

    gotoSource() {
        let source = Game.getObjectById(this.data.targetId);

        if(!source) {
            this.completeJob();
            return;
        }

        if(!this.creep.pos.isNearTo(source)) {
            this.creep.moveTo(source);
        }
        else {
            this.fsm.enter(STATE.HARVEST);
        }
    }

    harvestSource() {
        let source = Game.getObjectById(this.data.targetId);

        if(!source) {
            this.completeJob();
            return;
        }

        this.creep.harvest(source);
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.sources.map((energy) => {
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