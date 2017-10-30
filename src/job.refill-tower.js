const minds = require('mind');
const job_common = require('job.common');

const profiler = require('profiler');

const JOB_TYPE = 'refill-tower';

const STATE_GET_ENERGY = 'get-energy';
const STATE_REFILL = 'refill-tower';

class RefillTowerJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE_GET_ENERGY, {
            [STATE_GET_ENERGY]: {
                onTick: this.getEnergy.bind(this)
            },
            [STATE_REFILL]: {
                onTick: this.refillTower.bind(this)
            }
        })
    }

    getEnergy() {
        this.actions.withdrawFromStorage(RESOURCE_ENERGY, {
            onDone: () => this.fsm.enter(STATE_REFILL)
        });
    }

    refillTower() {
        this.actions.transferInto(this.data.targetId, RESOURCE_ENERGY, {
            onDone: () => this.completeJob()
        });
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.towers.filter(
            /**TowerMind*/tower => tower.needsEnergy
        ).map(/**TowerMind*/tower => {
            return new RefillTowerJobDTO(tower.tower);
        });
    }
}

class RefillTowerJobDTO extends job_common.JobDTO {
    constructor(target) {
        super('tower-'+target.id, JOB_TYPE, minds.available.transfer);

        this.targetId = target.id;
    }
}

module.exports = {
    getHandler() {return RefillTowerJobHandler},
    JOB_TYPE
};