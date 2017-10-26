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
        let storage = this.roomMgr.storage;

        if(!storage.isNear(this.creep)) {
            this.creep.mover.moveTo(storage.target);
        }
        else {
            storage.withdraw(this.creep);
            this.fsm.enter(STATE.DEPOSIT)
        }
    }

    depositEnergy() {
        let target = this.roomMgr.room.terminal;

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.mover.moveTo(target);
        }
        else {
            this.creep.transfer(target, RESOURCE_ENERGY);
            this.completeJob();
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        if(!manager.room.terminal || manager.storage.getStoredEnergy() < 20000) {
            return [];
        }

        if(manager.room.terminal.store[RESOURCE_ENERGY] > 25000) {
            return [];
        }

        return [new TerminalFillEnergyJobDTO(manager.room.terminal)];
    }
}

class TerminalFillEnergyJobDTO extends job_common.JobDTO {
    /**
     * @param {Structure} struct
     */
    constructor(struct) {
        super('terminal-fill-energy-'+struct.id, JOB_TYPE, minds.available.transfer);
    }
}

module.exports = {
    getHandler() {return TerminalFillEnergyJobHandler},
    JOB_TYPE
};