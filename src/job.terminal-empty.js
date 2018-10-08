var _ = require('lodash');
const minds = require('mind');
const job_common = require('job.common');

const profiler = require('profiler');

const JOB_TYPE = 'terminal-empty-energy';

const STATE = {
    PICKUP: 'pickup',
    DEPOSIT: 'deposit',
};

class TerminalEmptyJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.PICKUP, {
            [STATE.PICKUP]: {
                onTick: this.pickupFromTerminal.bind(this)
            },
            [STATE.DEPOSIT]: {
                onTick: this.depositToStorage.bind(this)
            }
        })
    }

    pickupFromTerminal() {
        this.actions.withdrawFrom(this.workRoom.terminal, RESOURCE_ENERGY, {
            onDone: () => this.fsm.enter(STATE.DEPOSIT)
        });
    }

    depositToStorage() {
        this.actions.unloadAllResources({
            onDone: () => this.completeJob(),
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
        if(storage.get(RESOURCE_ENERGY) < 12000 && terminal.get(RESOURCE_ENERGY) > 10000) {
            jobs.push(new TerminalEmptyJobDTO(terminal, RESOURCE_ENERGY));
        }

        return jobs;
    }
}

class TerminalEmptyJobDTO extends job_common.JobDTO {
    /**
     * @param {Structure} struct
     * @param resource
     */
    constructor(struct, resource) {
        super('terminal-empty-'+resource+'-'+struct.id, JOB_TYPE, minds.available.transfer);

        this.resource = resource;
    }
}

module.exports = {
    getHandler() {return TerminalEmptyJobHandler},
    JOB_TYPE
};