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
        if(_.sum(this.creep.carry) > 0) {
            this.emptyCarry();
            return;
        }

        let target = Game.getObjectById(this.data.labId);

        if(!target) {
            this.completeJob();
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.mover.moveTo(target);
        }
        else {
            this.creep.withdraw(target, this.data.resource);
            this.fsm.enter(STATE.DEPOSIT)
        }
    }

    emptyCarry() {
        let storage = this.roomMgr.storage;

        if(!storage.isNear(this.creep)) {
            this.creep.mover.moveTo(storage.target);
        }
        else {
            this.workRoom.storage.deposit(this.creep);
        }
    }

    depositIntoTerminal() {
        let terminal = this.roomMgr.terminal;

        if(!this.creep.pos.isNearTo(terminal)) {
            this.creep.mover.moveTo(terminal);
        }
        else {
            this.creep.transfer(terminal, this.data.resource);

            this.completeJob();
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        let jobs = [];

        let labMgr = manager.labs;

        if(!labMgr) {
            return jobs;
        }

        if(labMgr.fsm.state != 'unload' && labMgr.fsm.state != 'process') {
            return jobs;
        }

        let unloadThreshold = 1000;
        if(labMgr.fsm.state === 'unload') {
            unloadThreshold = 0;
        }

        for(let lab of labMgr.getOutputLabs()) {
            if(lab.mineralAmount > unloadThreshold) {
                jobs.push(new LabUnloadJobDTO(lab, lab.mineralType));
            }
        }

        if(labMgr.fsm.state === 'unload') {
            for(let input of labMgr.getInputLabs()) {
                if(input.lab.mineralAmount > unloadThreshold) {
                    jobs.push(new LabUnloadJobDTO(input.lab, input.lab.mineralType));
                }
            }
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