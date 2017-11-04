var _ = require('lodash');

let mind = require('mind.common');
let bb = require('utils.bodybuilder');

const profiler = require('profiler');

class TransferMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);
    }

    update() {
        if(this.creep.spawning) {return}

        if(!this.creep.workRoom) {return}

        if(this.shouldDespawn()) {
            this.warn('Im no longer needed ... Bye cruel world!');
            this.creep.suicide();
            return;
        }

        let job = this.getJob();

        if(job && (this.creep.workRoom.isSKRoom || this.creep.workRoom.threat.getCombatCreeps().length === 0)) {
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

    shouldDespawn() {
        if(!this.creep.memory.emergency) {
            return false;
        }

        let others = _.without(this.workRoom.getMinds(TransferMind), this);

        let alive = others.filter(mind => !mind.creep.spawning);

        if(alive.length > 0) {
            return true;
        }

        return false;
    }

    *findNewJob() {
        if(this.creep.memory.hauler) {
            yield this.tryClaimJob(1, {
                type: 'terminal-fill-energy'
            });

            if(this.creep.ticksToLive > 100) {

                yield this.tryClaimJob(1, {
                    type: 'lab-unload'
                });

                yield this.tryClaimJob(1, {
                    type: 'lab-load'
                });
            }

            yield this.tryClaimJob(1, {
                type: 'empty-storage-link'
            });

            yield this.tryClaimJob(1, {
                type: 'controller-link'
            });
        }

        if(this.storage.getStoredEnergy() > 100) {
            if (this.room.energyMissing > 50) {
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

            yield this.tryClaimJob(1, {
                type: 'controller-link'
            });
        }

        yield this.tryClaimJob(1, {
            type: 'empty-storage-link'
        });

        let availableCapacity = this.creep.carryCapacity - _.sum(this.creep.carry);

        yield this.tryClaimJob(availableCapacity, {
            type: 'energy-pickup',
            minAmount: Math.max(Math.min(availableCapacity / 2, 250), 50)
        });

        yield this.tryClaimJob(availableCapacity, {
            type: 'empty-container',
            minAmount: Math.max(availableCapacity / 2, 50)
        });

        yield this.tryClaimJob(1, {
            type: 'terminal-fill-energy'
        });

        if(this.creep.ticksToLive > 100) {

            yield this.tryClaimJob(1, {
                type: 'lab-unload'
            });

            yield this.tryClaimJob(1, {
                type: 'lab-load'
            });
        }

        yield this.tryClaimJob(1, {
            type: 'refill-extensions'
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
     * @param {{hauler}} options
     */
    static getSpawnParams(manager, options) {
        options = _.defaults(options || {}, {hauler: false});

        let body = [MOVE, MOVE, CARRY, CARRY];
        if(manager.room.energyCapacityAvailable > 500) {
            body = bb.build([CARRY, MOVE], 400);
        }

        if(manager.room.energyCapacityAvailable > 700) {
            body = bb.build([CARRY, CARRY, MOVE], 600);
        }

        if(manager.room.energyCapacityAvailable > 1000) {
            body = bb.build([CARRY, CARRY, MOVE], 1000, [WORK, CARRY, MOVE]);
        }

        if(manager.room.energyCapacityAvailable > 1600) {
            body = bb.build([CARRY, CARRY, MOVE], 1600, [WORK, CARRY, MOVE]);
        }

        return {
            body: body,
            name: options.hauler ? 'hauler' : 'transfer',
            memo: {
                mind: 'transfer',
                hauler: options.hauler,
            }
        };
    }
}

profiler.registerClass(TransferMind, TransferMind.name);

module.exports = {
    TransferMind
};