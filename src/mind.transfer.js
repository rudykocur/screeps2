
let MindBase = require('mind.common').MindBase;
let throttle = require('utils').throttle;

const STATE_SEEK = 'seekEnergy';
const STATE_TRANSPORT = 'move_energy';
const STATE_IDLE = 'idle';

class TransferMind extends MindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            [STATE_SEEK]: {
                onEnter: this.setPickupTarget.bind(this),
                onTick: this.doSeekEnergy.bind(this),
            },
            [STATE_TRANSPORT]: {
                onEnter: this.setTransferTarget.bind(this),
                onTick: this.doTransferEnergy.bind(this),
            },
            [STATE_IDLE]: {
                onEnter: () => {},
                onTick: () => throttle(10, this.checkStatus.bind(this)),
            },
        };

        this.setStateMachine(fsm, STATE_SEEK);
    }

    setPickupTarget() {
        let result = this.room.getDroppedEnergy(this.creep.pos, this.creep.carryCapacity);

        if(!result) {
            result = this.room.getDroppedEnergy(this.creep.pos, this.creep.carryCapacity * 0.25 );
        }

        if(!result) {
            this.enterState(STATE_IDLE);
            return;
        }

        this.localState.pickupId = result.id;
    }

    doSeekEnergy() {
        let target = Game.getObjectById(this.localState.pickupId);

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(target.pos.isNearTo(this.creep)) {
            if(target instanceof Resource) {
                this.creep.pickup(target);
            }
            else {
                this.creep.withdraw(target);
            }

            this.enterState(STATE_TRANSPORT);
        }
        else {
            this.creep.moveTo(target);
        }
    }

    checkStatus() {
        if(_.sum(this.creep.carry)) {
            this.enterState(STATE_TRANSPORT);
        }
        else {
            this.enterState(STATE_SEEK);
        }
    }

    setTransferTarget() {
        if(this.creep.room.energyAvailable < this.creep.room.energyCapacityAvailable) {
            let result = this.creep.pos.findClosestByPath(FIND_MY_SPAWNS, {
                filter: (spawn) => spawn.energy < spawn.energyCapacity
            });

            if(!result) {
                result = this.creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    filter: (struct) => {
                        if(struct.structureType != STRUCTURE_EXTENSION) {
                            return false;
                        }

                        return struct.energy < struct.energyCapacity;
                    }
                });
            }

            this.localState.transferId = result.id;
            return;
        }

        this.localState.transferToStorage = true;
    }

    doTransferEnergy() {
        if(this.localState.transferToStorage) {
            if(!this.room.storage.isNear(this.creep)) {
                this.creep.moveTo(this.room.storage.target);
            }
            else {
                this.room.storage.deposit(this.creep);
                this.enterState(STATE_SEEK)
            }
            return;
        }

        let target = Game.getObjectById(this.localState.transferId);

        if(!target) {
            this.enterState(STATE_IDLE);
            return;
        }

        if(target.pos.isNearTo(this.creep)) {
            this.creep.transfer(target, RESOURCE_ENERGY);

            this.enterState(STATE_SEEK);
        }
        else {
            this.creep.moveTo(target);
        }
    }
}

module.exports = {
    TransferMind
};