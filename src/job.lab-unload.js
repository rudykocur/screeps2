var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'lab-unload';

const STATE = {
    PICKUP: 'pickup',
    DEPOSIT: 'deposit',
};

class LabUnloadJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.PICKUP, {
            [STATE.PICKUP]: {
                onTick: this.pickupFromLab.bind(this)
            },
            [STATE.DEPOSIT]: {
                onTick: this.depositIntoTerminal.bind(this)
            }
        })
    }

    pickupFromLab() {
        if(this.creep.carryTotal > 0) {
            this.actions.unloadAllResources();
            return;
        }

        this.actions.withdrawFrom(this.data.labId, this.data.resource, {
            onDone: () => this.fsm.enter(STATE.DEPOSIT)
        });
    }

    depositIntoTerminal() {
        this.actions.transferInto(this.workRoom.terminal, this.data.resource, {
            onDone: () => this.completeJob()
        });
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

        for(let lab of manager.labs.getLabsToUnload()) {
            jobs.push(new LabUnloadJobDTO(lab, lab.mineralType));
        }

        return jobs;
    }
}

class LabUnloadJobDTO extends job_common.JobDTO {
    /**
     * @param {Structure} structure
     * @param resource
     */
    constructor(structure, resource) {
        super('lab-unload-'+resource+'-'+structure.id, JOB_TYPE, minds.available.transfer);

        this.labId = structure.id;
        this.resource = resource;
    }
}

module.exports = {
    getHandler() {return LabUnloadJobHandler},
    JOB_TYPE
};