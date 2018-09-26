var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');
const maps = require('maps');

const profiler = require('profiler');

const JOB_TYPE = 'empty-tombstones';

const emptyContainers = require('job.empty-containers');

class EmptyTombstonesJobHandler extends emptyContainers.EmptyContainerJobHandler {

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.data.tombstones.filter(/**Tombstone*/tomb => _.sum(tomb.store) > 0)
            .map(/**Tombstone*/tomb => {
            return new EmptyTombstoneJobDTO(tomb);
        });
    }
}

class EmptyTombstoneJobDTO extends job_common.JobDTO {
    /**
     * @param {Tombstone} tomb
     */
    constructor(tomb) {
        super('tomb-'+tomb.id, JOB_TYPE, minds.available.transfer, _.sum(tomb.store));

        this.targetId = tomb.id;
    }

    merge(data) {
        data.targetId = this.targetId;
        data.available = this.available;
    }
}

module.exports = {
    getHandler() {return EmptyTombstonesJobHandler},
    JOB_TYPE
};