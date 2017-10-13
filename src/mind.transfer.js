var _ = require('lodash');

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

        if(!this.creep.workRoom) {return}

        let job = this.getJob();

        if(job && !this.creep.workRoom.danger) {
            job.execute();
            return;
        }

        if(_.sum(this.creep.carry)) {
            return this.dropResourcesToStorage();
        }

        this.actions.gotoMeetingPoint();
    }

    get storage() {
        if(this.workRoom.isRemote) {
            return this.workRoom.parent.storage;
        }

        return this.workRoom.storage;
    }

    *findNewJob() {
        if(this.storage.getStoredEnergy() > 100) {
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
        });

        yield this.tryClaimJob(availableCapacity, {
            type: 'empty-container',
            minAmount: Math.max(availableCapacity / 2, 50)
        });
    }

    dropResourcesToStorage() {
        if(this.storage.canDeposit(this.creep)) {
            this.storage.deposit(this.creep);
        }
        else {
            this.creep.moveTo(this.storage.target);
        }
    }

    chillAtMeetingPoint() {
        if(!this.creep.pos.isNearTo(this.roomMgr.meetingPoint)) {
            this.creep.moveTo(this.roomMgr.meetingPoint);
        }
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager) {
        let body = [MOVE, MOVE, CARRY, CARRY];
        if(manager.room.energyCapacityAvailable > 500) {
            body = [MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY];
        }

        if(manager.room.energyCapacityAvailable > 700) {
            body = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
        }

        if(manager.room.energyCapacityAvailable > 1000) {
            body = [WORK, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
                    CARRY, CARRY, MOVE, CARRY, CARRY, MOVE];
        }

        return {
            body: body,
            name: 'transfer',
            memo: {'mind': 'transfer'}
        };
    }

}

module.exports = {
    TransferMind
};