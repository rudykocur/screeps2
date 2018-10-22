const minds = require('mind');
const job_common = require('job.common');

const profiler = require('profiler');

const JOB_TYPE = 'controller-link';

const STATE = {
    LOAD: 'load',
    RESERVE: 'reserve',
    UNLOAD: 'unload',
    SEND: 'send'
};

class ControllerLinkJobHandler extends job_common.JobHandlerBase {

    constructor(creep, jobData) {
        super(creep, jobData);

        this.configureFSM(STATE.LOAD, {
            [STATE.LOAD]: {
                onTick: this.getEnergy.bind(this)
            },
            [STATE.RESERVE]: {
                onTick: this.reserveLink.bind(this)
            },
            [STATE.UNLOAD]: {
                onTick: this.unloadEnergy.bind(this)
            },
            [STATE.SEND]: {
                onTick: this.sendEnergy.bind(this)
            }
        });
    }

    getEnergy() {
        this.actions.withdrawFromStorage(RESOURCE_ENERGY, {
            onDone: () => this.fsm.enter(STATE.RESERVE)
        });
    }

    reserveLink() {
        if(this.creep.pos.isNearTo(this.workRoom.storage.link)) {
            this.creep.mover.enterStationary();

            let cooldown = this.workRoom.storage.link.cooldown;

            if(this.workRoom.storage.link.reserve(cooldown + 2)) {
                this.fsm.enter(STATE.UNLOAD);
            }
        }
        else {
            this.actions.moveTo(this.workRoom.storage.link);
        }
    }

    unloadEnergy() {
        if(this.workRoom.storage.link.cooldown > 0) {
            this.workRoom.room.visual.circle(this.workRoom.storage.link.pos, {
                radius: 0.5,
                stroke: "red",
                strokeWidth: 0.3,
                fill: "transparent",
            });
            return;
        }

        let needed = this.workRoom.controller.getNeededEnergyInLink();
        let has = this.workRoom.storage.link.energy;
        let toTransfer = Math.min(needed, this.creep.carry[RESOURCE_ENERGY], has);
        let result = this.creep.transfer(this.workRoom.storage.link.link, RESOURCE_ENERGY, toTransfer);

        if(result === OK || toTransfer === 0) {
            this.fsm.enter(STATE.SEND);
        }
        else {
            this.err(this.workRoom, 'energy transfer failed', result, '::', toTransfer);

            if(result === ERR_FULL) {
                this.completeJob();
            }
        }
    }

    sendEnergy() {
        let from = this.workRoom.storage.link;
        let to = this.workRoom.controller.link;

        let energyToSend = Math.min(from.energy, to.energyCapacity - to.energy);

        let result = from.transferEnergy(to, energyToSend);

        if(result === OK) {
            this.completeJob();
        }
        else {
            if(result !== ERR_TIRED) {
                this.completeJob();
                this.err(this.workRoom, 'energy send failed', result, '::', energyToSend);
            }
            else {
                this.workRoom.room.visual.circle(from.pos, {stroke: "red"});
            }
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        if(!manager.storage || !manager.storage.link) {
            return [];
        }

        if(manager.storage.link.cooldown >= 6) {
            return [];
        }

        let needed = manager.controller.getNeededEnergyInLink();
        if(needed > 200) {
            return [new ControllerLinkJobDTO(manager)];
        }

        return [];
    }
}

class ControllerLinkJobDTO extends job_common.JobDTO {
    constructor(manager) {
        super('controller-link-'+manager.roomName, JOB_TYPE, minds.available.transfer);
    }
}

module.exports = {
    getHandler() {return ControllerLinkJobHandler},
    JOB_TYPE
};