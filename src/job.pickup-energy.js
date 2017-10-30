var _ = require('lodash');
const minds = require('mind');
const maps = require('maps');
const job_common = require('job.common');

const profiler = require('profiler');

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

        this.actions.unloadAllResources({
            storage: storage,
            onTick: () => {
                let struct = _.first(this.creep.pos.lookFor(LOOK_STRUCTURES));
                if(struct && struct.hits < struct.hitsMax) {
                    this.creep.repair(struct);
                }
            },
            onDone: () => this.completeJob(),
        });
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.data.droppedEnergy.map((energy) => {
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