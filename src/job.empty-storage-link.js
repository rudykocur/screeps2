var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');

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
        let link = Game.getObjectById(this.data.targetId);

        if(!link) {
            this.completeJob();
            return;
        }

        if(this.creep.pos.isNearTo(link)) {
            this.creep.withdraw(link, RESOURCE_ENERGY);
            this.fsm.enter(STATE.DEPOSIT);
        }
        else {
            this.creep.mover.moveTo(link);
        }
    }

    depositEnergy() {
        let storage = this.roomMgr.storage;

        if(!storage.canDeposit(this.creep)) {
            this.creep.mover.moveTo(storage.target);
        }
        else {
            if(_.sum(this.creep.carry) > 0) {
                storage.deposit(this.creep);
            }
            else {
                this.completeJob();
            }
        }
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