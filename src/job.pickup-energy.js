const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'energy-pickup';

class PickupEnergyJobHandler extends job_common.JobHandlerBase {

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.droppedEnergy.map((energy) => {
            return new EnergyJobDTO('energy-'+energy.id, energy.amount, 1, {});
        });
    }

    static deserializeJob(data) {
        return new EnergyJobDTO(data.id, data.available, data.claims);
    }
}

class EnergyJobDTO extends job_common.JobDTO {
    constructor(id, available, claims) {
        super(id, JOB_TYPE, minds.available.transfer, available, claims);
        // this.available = available;
    }

    merge(data) {
        data.available = this.available;
    }
}

module.exports = {
    getHandler() {return PickupEnergyJobHandler},
    JOB_TYPE
};