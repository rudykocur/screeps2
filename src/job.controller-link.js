const minds = require('mind');
const job_common = require('job.common');

const JOB_TYPE = 'controller-link';

const STATE = {
    LOAD: 'load',
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
            [STATE.UNLOAD]: {
                onTick: this.unloadEnergy.bind(this)
            },
            [STATE.SEND]: {
                onTick: this.sendEnergy.bind(this)
            }
        });
    }

    getEnergy() {
        if(this.roomMgr.storage.isNear(this.creep)) {
            this.roomMgr.storage.withdraw(this.creep);
            this.fsm.enter(STATE.UNLOAD);
        }
        else {
            this.creep.mover.moveTo(this.roomMgr.storage.target);
        }
    }

    unloadEnergy() {
        if(this.creep.pos.isNearTo(this.workRoom.storage.link)) {
            let cooldown = this.workRoom.storage.link.cooldown;

            if(this.workRoom.storage.reserveLink(cooldown + 2)) {

                let needed = this.workRoom.controller.getNeededEnergyInLink();
                let toTransfer = Math.min(needed, this.creep.carry[RESOURCE_ENERGY]);
                let result = this.creep.transfer(this.workRoom.storage.link, RESOURCE_ENERGY, toTransfer);

                if(result === OK) {
                    this.fsm.enter(STATE.SEND);
                }
                else {
                    console.log('energy transfer failed', result);
                }
            }
        }
        else {
            this.creep.mover.moveTo(this.workRoom.storage.link);
        }
    }

    sendEnergy() {
        let from = this.workRoom.storage.link;
        let to = this.workRoom.controller.link;

        let result = from.transferEnergy(to);

        if(result === OK) {
            this.completeJob();
        }
        else {
            if(result !== ERR_TIRED) {
                console.log('energy send failed', result);
            }
        }
    }

    /**
     * @param {RoomManager} manager
     * @return {Array<JobDTO>}
     */
    static generateJobs(manager) {
        if(!manager.storage.link) {
            return [];
        }

        let needed = manager.controller.getNeededEnergyInLink();
        if(needed > 50) {
            return [new ControllerLinkJobDTO(manager)];
        }
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