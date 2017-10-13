var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'empty-container';

const STATE = {
    PICKUP: 'pickup',
    DEPOSIT: 'deposit',
};

class EmptyContainerJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.PICKUP, {
            [STATE.PICKUP]: {
                onTick: this.pickupFromContainer.bind(this)
            },
            [STATE.DEPOSIT]: {
                onTick: this.depositEnergy.bind(this)
            }
        })
    }

    pickupFromContainer() {
        let container = Game.getObjectById(this.data.targetId);

        if(!container) {
            this.completeJob();
            return;
        }

        if(this.creep.pos.isNearTo(container)) {
            this.creep.withdraw(container, _.findKey(container.store));
            this.fsm.enter(STATE.DEPOSIT);
        }
        else {
            this.creep.moveTo(container);
        }
    }

    depositEnergy() {
        let storage;

        if(this.roomMgr.isRemote) {
            storage = this.roomMgr.parent.storage;
        }
        else {
            storage = this.roomMgr.storage;
        }

        if(!storage.canDeposit(this.creep)) {
            this.creep.moveTo(storage.target);
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
        return manager.containers.map(/**StructureContainer*/cnt=> {
            return new EmptyContainerJobDTO(cnt);
        });
    }
}

class EmptyContainerJobDTO extends job_common.JobDTO {
    /**
     * @param {StructureContainer} container
     */
    constructor(container) {
        super('container-'+container.id, JOB_TYPE, minds.available.transfer, _.sum(container.store));

        this.targetId = container.id;
    }

    merge(data) {
        data.targetId = this.targetId;
        data.available = this.available;
    }
}

module.exports = {
    getHandler() {return EmptyContainerJobHandler},
    JOB_TYPE
};