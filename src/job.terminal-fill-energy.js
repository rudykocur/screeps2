var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'terminal-fill-energy';

const STATE = {
    PICKUP: 'pickup',
    DEPOSIT: 'deposit',
};

class TerminalFillEnergyJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.PICKUP, {
            [STATE.PICKUP]: {
                onTick: this.pickupFromStorage.bind(this)
            },
            [STATE.DEPOSIT]: {
                onTick: this.depositEnergy.bind(this)
            }
        })
    }

    pickupFromStorage() {
        this.actions.withdrawFromStorage(this.data.resource || RESOURCE_ENERGY, {
            onDone: () => this.fsm.enter(STATE.DEPOSIT)
        });
    }

    depositEnergy() {
        this.actions.transferInto(this.workRoom.terminal, this.data.resource || RESOURCE_ENERGY, {
            onDone: () => this.completeJob()
        })
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        let jobs = [];

        let terminal = manager.room.terminal;
        let storage = manager.room.storage;

        if(!terminal || !storage) {
            return jobs;
        }

        for(let resource of [RESOURCE_ENERGY, manager.data.mineral.mineralType]) {
            if((storage.store[resource] || 0) > 20000 && (terminal.store[resource] || 0) < 25000) {
                jobs.push(new TerminalFillEnergyJobDTO(terminal, resource));
            }
        }

        return jobs;
    }
}

class TerminalFillEnergyJobDTO extends job_common.JobDTO {
    /**
     * @param {Structure} struct
     * @param resource
     */
    constructor(struct, resource) {
        super('terminal-fill-'+resource+'-'+struct.id, JOB_TYPE, minds.available.transfer);

        this.resource = resource;
    }
}

module.exports = {
    getHandler() {return TerminalFillEnergyJobHandler},
    JOB_TYPE
};