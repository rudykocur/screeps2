var _ = require('lodash');
const minds = require('mind');
const maps = require('maps');
const job_common = require('job.common');

const profiler = require('profiler');

const JOB_TYPE = 'empty-mine';

const STATE_GOTO_MINE = 'goto-mine';
const STATE_DEPOSIT = 'deposit-energy';

class EmptyMiningSiteJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE_GOTO_MINE, {
            [STATE_GOTO_MINE]: {
                onTick: this.getEnergy.bind(this)
            },
            [STATE_DEPOSIT]: {
                onTick: this.depositEnergy.bind(this)
            }
        });

    }

    getEnergy() {
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
            onTick: () => this.actions.repairRoad(),
            onDone: () => this.completeJob(),
            pathOptions: {
                ignoreAllLairs: this.creep.workRoom.isSKRoom,
            }
        });
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        return _.values(manager.mines)
            .filter(/**MiningSite*/ site => site.expectedEnergy > 100)
            .map(/**MiningSite*/ site => new EmptyMiningSiteJobDTO(site))
    }
}

class EmptyMiningSiteJobDTO extends job_common.JobDTO {
    /**
     * @param {MiningSite} site
     */
    constructor(site) {
        super('mine-'+site.structureId, JOB_TYPE, minds.available.transfer, site.expectedEnergy);

        this.targetId = site.structureId;

        let vis = site.source.room.visual;
        vis.circle(site.source.pos, {
                radius: 2,
                fill: 'transparent',
                stroke: 'blue',
                opacity: 0.8
            });

        site.energy.forEach(res => vis.circle(res.pos, {
            fill: 'transparent',
            stroke: 'red',
            radius: 1.1,
            lineStyle: 'dashed',
            opacity: 0.8
        }))
    }

    merge(data) {
        super.merge(data);
        data.available = this.available;
    }
}

module.exports = {
    getHandler() {return EmptyMiningSiteJobHandler},
    JOB_TYPE
};