const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'energy-pickup';

class PickupEnergyJobHandler {

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.droppedEnergy.map((energy) => {
            return new EnergyJobDTO(energy.id, energy.amount);
        });
    }

    static deserializeJob(data) {
        return new EnergyJobDTO(data.id, data.available);
    }
}

class EnergyJobDTO extends job_common.JobDTO {
    constructor(id, available) {
        super('energy-'+id, JOB_TYPE, minds.available.transfer);
        this.available = available;
    }

    merge(data) {
        data.available = this.available;
    }
}

module.exports = {
    getHandler() {return PickupEnergyJobHandler},
    JOB_TYPE
};