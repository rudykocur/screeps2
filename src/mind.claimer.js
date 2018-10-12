let mind = require('mind.common');
let maps = require('maps');
const utils = require('utils');

const profiler = require('profiler');

const STATE = {
    IDLE: 'idle',
    RESERVE: 'reserve'
};

/**
 * @typedef {Object} ClaimerMindState
 * @property {RoomPosition} controllerPos
 * @property {String} controllerPosStr
 */

class ClaimerMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        this.setStateMachine({
            [STATE.IDLE]: {
                onTick: () => {}
            },
            [STATE.RESERVE]: {
                onEnter: this.prepareState.bind(this),
                onTick: this.reserveController.bind(this)
            }
        }, STATE.RESERVE);
    }

    /**
     * @param {ClaimerMindState} state
     */
    prepareState(state) {
        let cache = maps.getRoomCache(this.creep.memory.roomName);
        let cacheCtrl = cache.controller;

        state.controllerPos = cacheCtrl.pos;
        state.controllerPosStr = cacheCtrl.pos.serialize();
    }

    /**
     * @param {ClaimerMindState} state
     */
    reserveController(state) {

        state.controllerPos = RoomPosition.unserialize(RoomPosition.prototype.serialize.call(state.controllerPos));

        if(this.creep.memory.claim && this.creep.memory.roomName != this.creep.pos.roomName) {
            this.creep.mover.moveByPath(() => {
                return maps.getMultiRoomPath(this.creep.pos, state.controllerPos, {
                    allowSKRooms: false,
                });
            });
            return;
        }

        if(this.workRoom) {
            let /**StructureController*/ target = this.workRoom.room.controller;

            if(!this.creep.pos.isNearTo(target)) {
                this.creep.mover.moveByPath(target, () =>{
                    return maps.getMultiRoomPath(this.creep.pos, target.pos, {
                        avoidHostile: false,
                    });
                });
                return;
            }
            this.creep.mover.enterStationary();

            let desiredSignMsg = this.workRoom.getRoomTitle();

            if(!target.sign || target.sign.text !== desiredSignMsg) {
                this.creep.signController(target, desiredSignMsg);
            }

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
            this.creep.mover.moveByPath(state.controllerPos, () =>{
                return maps.getMultiRoomPath(this.creep.pos, state.controllerPos, {
                    avoidHostile: false,
                });
            })
        }
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager, options) {
        options = options || {};

        let body = [CLAIM, MOVE, MOVE, MOVE];

        if(manager.room.energyCapacityAvailable >= 1300) {
            body = [CLAIM, CLAIM, MOVE, MOVE];
        }

        if(manager.room.energyCapacityAvailable >= 1500) {
            body = [CLAIM, CLAIM, MOVE, MOVE, MOVE, MOVE, MOVE];
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