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
        this.actions.withdrawFromStorage(RESOURCE_ENERGY, {
            onDone: () => this.fsm.enter(STATE_REFILL)
        });
    }

    refillSpawn() {
        this.actions.transferInto(this.data.targetId, RESOURCE_ENERGY, {
            onDone: () => this.completeJob()
        });
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.data.spawns.filter(
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