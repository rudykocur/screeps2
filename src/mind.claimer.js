let mind = require('mind.common');
let maps = require('maps');
const utils = require('utils');

const STATE = {
    IDLE: 'idle',
    RESERVE: 'reserve'
};

class ClaimerMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        this.setStateMachine({
            [STATE.IDLE]: {
                onTick: () => {}
            },
            [STATE.RESERVE]: {
                onTick: this.reserveController.bind(this)
            }
        }, STATE.RESERVE);
    }

    reserveController() {
        if(this.workRoom) {
            let target = this.workRoom.room.controller;

            if(!this.creep.pos.isNearTo(target)) {
                this.creep.mover.moveTo(target);
                return;
            }
            this.creep.mover.enterStationary();

            if(this.creep.memory.claim) {
                this.creep.claimController(target);
            }
            else {
                if ((target.reservation && target.reservation.username != utils.myUsername()) ||
                    (target.owner && target.owner != utils.myUsername())) {
                    this.creep.attackController(target);
                }
                else {
                    this.creep.reserveController(target)
                }
            }
        }
        else {
            let cache = maps.getRoomCache(this.creep.memory.roomName);
            let target = cache.controller;
            this.creep.mover.moveTo(target.pos);
        }
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager, options) {
        options = options || {};

        let body = [CLAIM, MOVE];

        if(!options.claim && manager.room.energyCapacityAvailable >= 1300) {
            body = [CLAIM, CLAIM, MOVE, MOVE];
        }

        return {
            body: body,
            name: 'claimer',
            memo: {
                mind: 'claimer',
                claim: !!options.claim
            }
        };
    }
}

module.exports = {
    ClaimerMind
};