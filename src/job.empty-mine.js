var _ = require('lodash');
const minds = require('mind');
const maps = require('maps');
const job_common = require('job.common');

const profiler = require('profiler');

const JOB_TYPE = 'empty-mine';

const STATE_UNLOAD_INIT = 'unload_init';
const STATE_GOTO_MINE = 'goto-mine';
const STATE_DEPOSIT = 'deposit-energy';

/**
 * @property {EmptyMiningSiteJobDTO} data
 */
class EmptyMiningSiteJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE_UNLOAD_INIT, {
            [STATE_UNLOAD_INIT]: {
                onTick: this.unloadInit.bind(this),
            },
            [STATE_GOTO_MINE]: {
                onTick: this.getEnergy.bind(this)
            },
            [STATE_DEPOSIT]: {
                onTick: this.depositEnergy.bind(this)
            }
        });

    }

    getEnergy() {
        /**
         * @type {Room}
         */
        let room = Game.rooms[this.data.roomName];

        if(!room) {
            this.debug('NO ROOM', this.data.roomName, '::', this.data.targetId);
            return this.completeJob();
        }

        let mgr = room.manager;

        if(!(this.data.targetId in mgr.mines)) {
            let obj = Game.getObjectById(this.data.targetId);
            this.debug('Invalid mine id', mgr, '::', this.data.targetId,
                '::', Object.keys(mgr.mines), '::', obj.pos, '::', obj);
            return this.completeJob();
        }

        let mine = mgr.mines[this.data.targetId];

        if(this.creep.carryMax) {
            return this.fsm.enter(STATE_DEPOSIT);
        }

        if(mine.source.pos.inRangeTo(this.creep, 2)) {
            let target = _.first(mine.energy);

            if(target) {
                this.creep.pickup(target);
            }

            if(!target && mine.container && mine.container.store[RESOURCE_ENERGY] > 50) {
                target = mine.container;

                this.creep.withdraw(target, RESOURCE_ENERGY);
            }

            if(target) {
                this.actions.moveTo(target);
            }
            else {
                if(this.creep.carryTotal > 0) {
                    this.fsm.enter(STATE_DEPOSIT);
                }
                else {
                    this.completeJob();
                }
            }
        }
        else {
            this.actions.moveTo(mine.container || mine.source);
        }
    }

    unloadInit() {
        if(this.creep.carryTotal === 0) {
            return this.fsm.enter(STATE_GOTO_MINE);
        }

        this._doUnload(() => this.fsm.enter(STATE_GOTO_MINE))
    }

    depositEnergy() {
        this._doUnload(() => this.completeJob())
    }

    _doUnload(onDone) {
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
            onDone: onDone,
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
        this.roomName = site.source.pos.roomName;

        let vis = site.source.room.visual;
        vis.circle(site.source.pos, {
                radius: 2,
                fill: 'transparent',
                stroke: site.hasMiner ? 'blue' : 'red',
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
        data.roomName = this.roomName;
    }
}

module.exports = {
    getHandler() {return EmptyMiningSiteJobHandler},
    JOB_TYPE
};