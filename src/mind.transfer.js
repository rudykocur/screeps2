
let MindBase = require('mind.common').MindBase;

const STATE_SEEK = 'seekEnergy';
const STATE_TRANSPORT = 'move_energy';
const STATE_IDLE = 'idle';

class TransferMind extends MindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            STATE_SEEK: {
                onEnter: () => {},
                onTick: () => {},
            },
            STATE_TRANSPORT: {
                onEnter: () => {},
                onTick: () => {},
            },
            STATE_IDLE: {
                onEnter: () => {},
                onTick: () => {},
            },
        }

    }

    update() {
        switch(this.state) {
            case 'seekEnergy':
                this.doSeekEnergy();
                break;
            case 'moveEnergy':
                this.doMoveEnergy();
                break;
            case 'idle':
                this.checkStatus();
                break;
            default:
                this.enterState('seekEnergy');
        }
    }

    checkStatus() {
        if(this.creep.room.energyAvailable == this.creep.room.energyCapacityAvailable) {
            return;
        }

        if(_.sum(this.creep.carry)) {
            this.enterState('moveEnergy');
        }
        else {
            this.enterState('seekEnergy');
        }
    }

    doSeekEnergy() {
        if(this.creep.room.energyAvailable == this.creep.room.energyCapacityAvailable) {
            this.enterState('idle');
            return;
        }

        let target = this.getLocalTarget('targetId', () => {
            let result = this.room.getDroppedEnergy(this.creep.pos, this.creep.carryCapacity);

            if(!result) {
                result = this.room.getDroppedEnergy(this.creep.pos);
            }

            return result;
        });

        if(!target) {
            return;
        }

        if(target.pos.isNearTo(this.creep)) {
            this.creep.pickup(target);
            this.enterState('moveEnergy');
        }
        else {
            this.creep.moveTo(target);
        }
    }

    doMoveEnergy() {
        let target = this.getLocalTarget('targetId', () => {
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

            return result;
        });

        if(!target) {
            this.enterState('idle');
            return;
        }

        if(target.pos.isNearTo(this.creep)) {
            this.creep.transfer(target, RESOURCE_ENERGY);
            this.enterState('seekEnergy');
        }
        else {
            this.creep.moveTo(target);
        }
    }
}

module.exports = {
    TransferMind
};