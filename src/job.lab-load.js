var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'lab-load';

const STATE = {
    PICKUP: 'pickup',
    DEPOSIT: 'deposit',
};

class LabLoadJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.PICKUP, {
            [STATE.PICKUP]: {
                onTick: this.pickupResource.bind(this)
            },
            [STATE.DEPOSIT]: {
                onTick: this.loadIntoLab.bind(this)
            }
        })
    }

    pickupResource() {
        if(this.creep.carryTotal > 0) {
            this.actions.unloadAllResources();
            return;
        }

        let source;

        if(this.roomMgr.room.storage.get(this.data.resource) > 0) {
            source = this.roomMgr.room.storage;
        }
        else if(this.roomMgr.terminal.get(this.data.resource) > 0) {
            source = this.roomMgr.terminal;
        }
        else {
            this.warn('Nowhere to load', this.data.resource, 'from. Room:', this.roomMgr);
            return;
        }

        this.actions.withdrawFrom(source, this.data.resource, {
            getAmount: () => {
                let lab = Game.getObjectById(this.data.labId);
                let needed = lab.mineralCapacity - lab.mineralAmount;
                let have = source.get(this.data.resource);

                return Math.min(needed, this.creep.carryCapacity, have)
            },

            onDone: () => this.fsm.enter(STATE.DEPOSIT)
        })
    }

    loadIntoLab() {
        this.actions.transferInto(this.data.labId, this.data.resource, {
            onDone: this.completeJob.bind(this),
        })
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        if(!manager.labs) {
            return [];
        }

        let jobs = [];

        for(let input of manager.labs.getLabsToLoad()) {
            if(input.resource !== RESOURCE_ENERGY && input.lab.mineralAmount + 500 > input.lab.mineralCapacity) {
                continue;
            }

            if(input.resource === RESOURCE_ENERGY && input.lab.energy + 500 > input.lab.energyCapacity) {
                continue;
            }

            if(manager.terminal.get(input.resource) +  manager.room.storage.get(input.resource) === 0) {
                continue;
            }

            jobs.push(new LabLoadJobDTO(input.lab.id, input.resource));
        }

        return jobs;
    }
}

class LabLoadJobDTO extends job_common.JobDTO {
    /**
     * @param structId
     * @param resource
     */
    constructor(structId, resource) {
        super('lab-load-'+resource+'-'+structId, JOB_TYPE, minds.available.transfer);

        this.labId = structId;
        this.resource = resource;
    }
}

module.exports = {
    getHandler() {return LabLoadJobHandler},
    JOB_TYPE
};