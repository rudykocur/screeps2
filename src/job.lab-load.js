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
        if(_.sum(this.creep.carry) > 0) {
            this.emptyCarry();
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

        if(!this.creep.pos.isNearTo(source)) {
            this.creep.mover.moveTo(source);
        }
        else {
            let target = Game.getObjectById(this.data.labId);
            let needed = target.mineralCapacity - target.mineralAmount;
            let have = source.get(this.data.resource);

            this.creep.withdraw(source, this.data.resource,
                Math.min(needed, this.creep.carryCapacity, have));

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