const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'refill-extensions';

class RefillExtensionsJobHandler extends job_common.JobHandlerBase {

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.extensionsClusters.filter(
            /**ExtensionCluster*/cluster => cluster.needsEnergy
        ).map((cluster) => {
            return new RefillExtensionsDTO(cluster.id, 1, {});
        });
    }

    static deserializeJob(data) {
        return new RefillExtensionsDTO(data.id, data.available, data.claims);
    }
}

class RefillExtensionsDTO extends job_common.JobDTO {
    constructor(id, available, claims) {
        super(id, JOB_TYPE, minds.available.transfer, available, claims);
    }
}

module.exports = {
    getHandler() {return RefillExtensionsJobHandler},
    JOB_TYPE
};