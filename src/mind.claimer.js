let mind = require('mind.common');
let maps = require('maps');
const utils = require('utils');

const profiler = require('profiler');

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

        if(this.creep.memory.claim && this.creep.memory.roomName != this.creep.pos.roomName) {
            this.creep.mover.moveByPath(() => {
                let cache = maps.getRoomCache(this.creep.memory.roomName);
                let cacheCtrl = cache.controller;
                maps.getMultiRoomPath(this.creep.pos, cacheCtrl.pos);

                return maps.getMultiRoomPath(this.creep.pos, cacheCtrl.pos);
            });
            return;
        }

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

        if(manager.room.energyCapacityAvailable >= 1300) {
            body = [CLAIM, CLAIM, MOVE, MOVE];
        }

        if(options.claim) {
            body = [CLAIM, MOVE, MOVE, MOVE, MOVE, MOVE];
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

profiler.registerClass(ClaimerMind, ClaimerMind.name);

module.exports = {
    ClaimerMind
};