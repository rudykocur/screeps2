var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');

const profiler = require('profiler');

const JOB_TYPE = 'empty-storage-link';

const STATE = {
    PICKUP: 'pickup',
    DEPOSIT: 'deposit',
};

class EmptyStorageLinkJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.PICKUP, {
            [STATE.PICKUP]: {
                onTick: this.pickupFromLink.bind(this)
            },
            [STATE.DEPOSIT]: {
                onTick: this.depositEnergy.bind(this)
            }
        })
    }

    pickupFromLink() {
        this.actions.withdrawFrom(this.data.targetId, RESOURCE_ENERGY, {
            onDone: () => this.fsm.enter(STATE.DEPOSIT)
        });
    }

    depositEnergy() {
        this.actions.unloadAllResources({
            onDone: () => this.completeJob()
        })
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        if(!manager.storage || !manager.storage.link) {
            return [];
        }

        if(!manager.storage.link.reserved && manager.storage.link.link.energy > 0) {
            return [new EmptyStorageLinkJobDTO(manager.storage.link)];
        }

        return [];
    }
}

class EmptyStorageLinkJobDTO extends job_common.JobDTO {
    /**
     * @param {StructureLink} link
     */
    constructor(link) {
        super('storage-link-'+link.id, JOB_TYPE, minds.available.transfer);

        this.targetId = link.id;
    }
}

module.exports = {
    getHandler() {return EmptyStorageLinkJobHandler},
    JOB_TYPE
};