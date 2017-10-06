const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'refill-tower';

const STATE_GET_ENERGY = 'get-energy';
const STATE_REFILL = 'refill-tower';

class RefillTowerJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE_GET_ENERGY, {
            [STATE_GET_ENERGY]: {
                onTick: this.getEnergy.bind(this)
            },
            [STATE_REFILL]: {
                onTick: this.refillTower.bind(this)
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

    refillTower() {
        let tower = Game.getObjectById(this.data.targetId);

        if(this.creep.pos.isNearTo(tower)) {
            this.creep.transfer(tower, RESOURCE_ENERGY);
            this.completeJob();
        }
        else {
            this.creep.moveTo(tower);
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return manager.towers.filter(
            /**TowerMind*/tower => tower.needsEnergy
        ).map(/**TowerMind*/tower => {
            return new RefillTowerJobDTO(tower.tower);
        });
    }
}

class RefillTowerJobDTO extends job_common.JobDTO {
    constructor(target) {
        super('tower-'+target.id, JOB_TYPE, minds.available.transfer);

        this.targetId = target.id;
    }
}

module.exports = {
    getHandler() {return RefillTowerJobHandler},
    JOB_TYPE
};