const minds = require('mind');
const maps = require('maps');
const job_common = require('job.common');

const JOB_TYPE = 'energy-pickup';

const STATE_GET_ENERGY = 'get-energy';
const STATE_DEPOSIT = 'deposit-energy';

class PickupEnergyJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE_GET_ENERGY, {
            [STATE_GET_ENERGY]: {
                onTick: this.getEnergy.bind(this)
            },
            [STATE_DEPOSIT]: {
                onTick: this.depositEnergy.bind(this)
            }
        });

    }

    getEnergy() {
        let resource = Game.getObjectById(this.data.targetId);

        if(!resource) {
            this.completeJob();
            return;
        }

        if(!this.creep.pos.isNearTo(resource)) {
            this.creep.mover.moveTo(resource, {costCallback: maps.blockHostileRooms, visualizePathStyle: {}});
        }
        else {
            this.creep.pickup(resource);
            this.unclaim();
            this.fsm.enter(STATE_DEPOSIT);
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

        this.creep.repair(_.first(this.creep.pos.lookFor(LOOK_STRUCTURES)));

        if(!storage.canDeposit(this.creep)) {
            this.creep.mover.moveTo(storage.target);
        }
        else {
            storage.deposit(this.creep);
            this.completeJob();
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.droppedEnergy.map((energy) => {
            return new EnergyJobDTO(energy);
        });
    }
}

class EnergyJobDTO extends job_common.JobDTO {
    /**
     * @param {Resource} resource
     */
    constructor(resource) {
        super('energy-'+resource.id, JOB_TYPE, minds.available.transfer, resource.amount);

        this.targetId = resource.id;
    }

    merge(data) {
        data.available = this.available;
    }
}

module.exports = {
    getHandler() {return PickupEnergyJobHandler},
    JOB_TYPE
};