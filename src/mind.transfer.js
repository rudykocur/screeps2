
let mind = require('mind.common');
let throttle = require('utils').throttle;

const STATE_SEEK = 'seekEnergy';
const STATE_TRANSPORT = 'move_energy';
const STATE_IDLE = 'idle';

class TransferMind extends mind.CreepMindBase {
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
        let result;
        if(this.room.energyCapacity < this.room.energyCapacityAvailable) {
            if(this.roomMgr.storage.getStoredEnergy() > this.creep.carryCapacity / 2) {
                result = this.roomMgr.storage.target;
            }
        }

        if(!result) {
            result = this.roomMgr.getDroppedEnergy(this.creep.pos, this.creep.carryCapacity);
        }

        if(!result) {
            result = this.roomMgr.getDroppedEnergy(this.creep.pos, this.creep.carryCapacity * 0.25 );
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

            this.checkStatus();
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
        let result;

        if(this.room.energyAvailable < this.room.energyCapacityAvailable) {
            result = this.creep.pos.findClosestByPath(FIND_MY_SPAWNS, {
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
        }

        if(!result) {
            result = _.first(this.roomMgr.towers.filter((tower) => {
                return tower.needsEnergy()
            }));
        }

        if(result) {
            this.localState.transferId = result.id;
            return;
        }

        this.localState.transferToStorage = true;
    }

    doTransferEnergy() {
        if(this.localState.transferToStorage) {
            if(this.roomMgr.storage.canDeposit(this.creep)) {
                this.roomMgr.storage.deposit(this.creep);
                this.enterState(STATE_SEEK)

            }
            else {
                this.creep.moveTo(this.roomMgr.storage.target);
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

            this.checkStatus();
        }
        else {
            this.creep.moveTo(target);
        }
    }
}

module.exports = {
    TransferMind
};