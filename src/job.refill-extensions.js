const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'refill-extensions';

const STATE_GET_ENERGY = 'get-energy';
const STATE_REFILL = 'refill-ext';

class RefillExtensionsJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.cluster = _.first(this.roomMgr.extensionsClusters.filter(cluster => cluster.id == this.data.id));

        this.configureFSM(STATE_GET_ENERGY, {
            [STATE_GET_ENERGY]: {
                onTick: this.getEnergy.bind(this)
            },
            [STATE_REFILL]: {
                onTick: this.refillExtensions.bind(this)
            }
        })
    }

    getEnergy() {
        if(this.roomMgr.storage.isNear(this.creep)) {
            this.roomMgr.storage.withdraw(this.creep);
            this.fsm.enter(STATE_REFILL);
        }
        else {
            this.creep.moveTo(this.roomMgr.storage.target);
        }
    }

    refillExtensions() {
        if(!this.cluster.needsEnergy) {
            this.completeJob();
            return;
        }

        if(_.sum(this.creep.carry) < 1) {
            this.completeJob();
            return;
        }

        if(this.creep.pos.isEqualTo(this.cluster.center)) {
            let ext = _.first(this.cluster.extensions.filter(
                /**StructureExtension*/e => e.energy < e.energyCapacity));

            this.creep.transfer(ext, RESOURCE_ENERGY);
        }
        else {
            if(this.creep.pos.getRangeTo(this.cluster.center) < 3) {
                let ext = _.first(this.cluster.extensions.filter(
                    e => e.energy < e.energyCapacity && this.creep.pos.isNearTo(e.pos)
                ));

                if(ext) {
                    this.creep.transfer(ext, RESOURCE_ENERGY);
                }
            }
            this.creep.moveTo(this.cluster.center);
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.extensionsClusters.filter(
            /**ExtensionCluster*/cluster => cluster.needsEnergy
        ).map((cluster) => {
            return new RefillExtensionsDTO(cluster.id);
        });
    }
}

class RefillExtensionsDTO extends job_common.JobDTO {
    constructor(id) {
        super(id, JOB_TYPE, minds.available.transfer);
    }
}

module.exports = {
    getHandler() {return RefillExtensionsJobHandler},
    JOB_TYPE
};