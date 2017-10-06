const _ = require('lodash');

let mind = require('mind.common');
let throttle = require('utils').throttle;
// let jobs = require('job.board');

const STATE_SEEK = 'seekEnergy';
const STATE_TRANSPORT = 'move_energy';
const STATE_IDLE = 'idle';

class TransferMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);
    }

    update() {
        if(this.creep.spawning) {return}

        let job = this.getJob();

        if(job) {
            job.execute();
            return;
        }

        if(_.sum(this.creep.carry)) {
            return this.dropResourcesToStorage();
        }

        this.chillAtMeetingPoint();
    }

    *findNewJob() {
        if(this.roomMgr.storage.getStoredEnergy() > 100) {
            if (this.room.energyMissing > 100) {
                yield this.tryClaimJob(1, {
                    type: 'refill-extensions'
                });

                yield this.tryClaimJob(1, {
                    type: 'refill-spawns'
                });
            }

            yield this.tryClaimJob(1, {
                    type: 'refill-tower'
                });
        }

        let availableCapacity = this.creep.carryCapacity - _.sum(this.creep.carry);

        yield this.tryClaimJob(availableCapacity, {
            type: 'energy-pickup',
            minAmount: Math.max(availableCapacity / 2, 50)
        })
    }

    dropResourcesToStorage() {
        if(this.roomMgr.storage.canDeposit(this.creep)) {
            this.roomMgr.storage.deposit(this.creep);
        }
        else {
            this.creep.moveTo(this.roomMgr.storage.target);
        }
    }

    chillAtMeetingPoint() {
        if(!this.creep.pos.isNearTo(this.roomMgr.meetingPoint)) {
            this.creep.moveTo(this.roomMgr.meetingPoint);
        }
    }

}

module.exports = {
    TransferMind
};