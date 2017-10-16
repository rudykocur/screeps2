const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'refill-spawns';

const STATE_GET_ENERGY = 'get-energy';
const STATE_REFILL = 'refill-ext';

class RefillSpawnsJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE_GET_ENERGY, {
            [STATE_GET_ENERGY]: {
                onTick: this.getEnergy.bind(this)
            },
            [STATE_REFILL]: {
                onTick: this.refillSpawn.bind(this)
            }
        })
    }

    getEnergy() {
        if(this.roomMgr.storage.isNear(this.creep)) {
            this.roomMgr.storage.withdraw(this.creep);
            this.fsm.enter(STATE_REFILL);
        }
        else {
            this.creep.mover.moveTo(this.roomMgr.storage.target);
        }
    }

    refillSpawn() {
        let spawn = Game.getObjectById(this.data.targetId);

        if(this.creep.pos.isNearTo(spawn)) {
            this.creep.transfer(spawn, RESOURCE_ENERGY);
            this.completeJob();
        }
        else {
            this.creep.mover.moveTo(spawn);
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.spawns.filter(
            /**StructureSpawn*/spawn => spawn.energy < spawn.energyCapacity
        ).map((spawn) => {
            return new RefillSpawnJobDTO(spawn);
        });
    }
}

class RefillSpawnJobDTO extends job_common.JobDTO {
    constructor(target) {
        super('spawn-'+target.id, JOB_TYPE, minds.available.transfer);

        this.targetId = target.id;
    }
}

module.exports = {
    getHandler() {return RefillSpawnsJobHandler},
    JOB_TYPE
};