const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'refill-spawns';

class RefillSpawnsJobHandler extends job_common.JobHandlerBase {

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.spawns.filter(
            /**StructureSpawn*/spawn => spawn.energy < spawn.energyCapacity
        ).map((spawn) => {
            return new job_common.JobDTO('spawn-'+spawn.id, JOB_TYPE, minds.available.transfer, 1, {});
        });
    }

    static deserializeJob(data) {
        return new job_common.JobDTO(data.id, JOB_TYPE, minds.available.transfer, data.available, data.claims);
    }
}

module.exports = {
    getHandler() {return RefillSpawnsJobHandler},
    JOB_TYPE
};