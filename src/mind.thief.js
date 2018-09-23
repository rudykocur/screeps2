var _ = require('lodash');
let mind = require('mind.common');
const maps = require('maps');
let bb = require('utils.bodybuilder');

const profiler = require('profiler');

const STATE_STEAL = 'steal';
const STATE_DEPOSIT = 'deposit';
const STATE_ENTER = 'enter-room';

class ThiefMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            [STATE_STEAL]: {
                onTick: this.doSteal.bind(this),
            },
            [STATE_DEPOSIT]: {
                onTick: this.doDeposit.bind(this),
            },
            [STATE_ENTER]: {
                onTick: this.gotoRoom.bind(this),
            }
        };

        this.setStateMachine(fsm, STATE_ENTER);
    }

    gotoRoom() {
        if(this.creep.pos.roomName === this.creep.memory.roomName) {
            this.enterState(STATE_STEAL);
            return;
        }

        this.creep.mover.moveByPath(() => {
            let cache = maps.getRoomCache(this.creep.memory.roomName);
            let cacheCtrl = cache.controller;

            return maps.getMultiRoomPath(this.creep.pos, cacheCtrl.pos);
        });
    }

    doSteal() {
        if(!this.workRoom) {
            return;
        }

        if(_.sum(this.creep.carry) === this.creep.carryCapacity) {
            this.enterState(STATE_DEPOSIT);
        }

        let target = this.creep.room.storage;

        if(this.creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            this.creep.mover.moveByPath(target, () =>{
                return maps.getMultiRoomPath(this.creep.pos, target.pos);
            });
        }
    }

    doDeposit() {

        if(!this.workRoom) {
            return;
        }

        if(_.sum(this.creep.carry) === 0) {
            this.enterState(STATE_STEAL);
            return;
        }

        this.actions.unloadAllResources({
            storage: this.roomMgr.parent.storage,
        });

    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager) {

        let body = bb.build([CARRY, CARRY, MOVE], manager.room.energyCapacityAvailable);

        return {
            body: body,
            name: 'thief',
            memo: {'mind': 'thief'}
        };
    }
}

profiler.registerClass(ThiefMind, ThiefMind.name);

module.exports = {
    ThiefMind
};