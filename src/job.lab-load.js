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
                onTick: this.pickupFromStorage.bind(this)
            },
            [STATE.DEPOSIT]: {
                onTick: this.loadIntoLab.bind(this)
            }
        })
    }

    pickupFromStorage() {
        if(_.sum(this.creep.carry) > 0) {
            this.emptyCarry();
            return;
        }

        let terminal = this.roomMgr.terminal;

        if(!this.creep.pos.isNearTo(terminal)) {
            this.creep.mover.moveTo(terminal);
        }
        else {
            let target = Game.getObjectById(this.data.labId);
            let needed = target.mineralCapacity - target.mineralAmount;

            this.creep.withdraw(terminal, this.data.resource, Math.min(needed, this.creep.carryCapacity));

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

    loadIntoLab() {
        let target = Game.getObjectById(this.data.labId);

        if(!target) {
            this.completeJob();
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.mover.moveTo(target);
        }
        else {
            this.creep.transfer(target, this.data.resource);
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

        if(labMgr.fsm.state != 'load' && labMgr.fsm.state != 'process') {
            return jobs;
        }

        for(let input of labMgr.getInputLabs()) {
            if(input.lab.mineralAmount + 500 > input.lab.mineralCapacity) {
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