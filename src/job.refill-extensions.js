const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'refill-extensions';

class RefillExtensionsJobHandler {

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.extensionsClusters.filter(
            /**ExtensionCluster*/cluster => cluster.needsEnergy
        ).map((cluster) => {
            return new RefillExtensionsDTO(cluster.id);
        });
    }

    static deserializeJob(data) {
        return new RefillExtensionsDTO(data.id, data.available);
    }
}

class RefillExtensionsDTO extends job_common.JobDTO {
    constructor(id) {
        super(id, JOB_TYPE, minds.available.transfer);
    }
}

module.exports = {
    getHandler() {return RefillExtensionsJobHandler},
    JOB_TYPE
};