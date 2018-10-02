var _ = require('lodash');
let mind = require('mind.common');
const maps = require('maps');
let bb = require('utils.bodybuilder');

const profiler = require('profiler');

const STATE_REFILL = 'refill';
const STATE_BUILD = 'build';
const STATE_ENTER = 'enter-room';

class SettlerMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            [STATE_REFILL]: {
                onTick: this.doRefill.bind(this),
            },
            [STATE_BUILD]: {
                onTick: this.doBuild.bind(this),
            },
            [STATE_ENTER]: {
                onTick: this.gotoRoom.bind(this),
            }
        };

        this.setStateMachine(fsm, STATE_ENTER);
    }

    gotoRoom() {
        if(this.creep.pos.roomName === this.creep.memory.roomName) {
            this.enterState(STATE_REFILL);
            return;
        }

        this.creep.mover.moveByPath(() => {
            let cache = maps.getRoomCache(this.creep.memory.roomName);
            let cacheCtrl = cache.controller;

            return maps.getMultiRoomPath(this.creep.pos, cacheCtrl.pos, {
                allowSKRooms: false,
            });
        });
    }

    doRefill() {
        if(!this.workRoom) {
            return;
        }

        if(_.sum(this.creep.carry) === this.creep.carryCapacity) {
            this.enterState(STATE_BUILD);
        }

        let source;
        if(this.workRoom.room.storage && this.workRoom.room.storage.store[RESOURCE_ENERGY] > 0) {
            source = this.workRoom.room.storage;
        }

        if(!source) {
            source = this.creep.pos.findClosestByPath(
                this.workRoom.room.find(FIND_DROPPED_RESOURCES, {
                    filter: /**Resource*/res => res.amount > 50
                })
            );
        }
        if(!source) {
            source = this.creep.pos.findClosestByPath(this.workRoom.room.find(FIND_SOURCES_ACTIVE));
        }

        if(this.creep.pos.isNearTo(source)) {
            this.creep.pickup(source);
            this.creep.harvest(source);
            this.creep.withdraw(source, RESOURCE_ENERGY);
            this.creep.mover.enterStationary();
        }
        else {
            this.creep.mover.moveTo(source, {visualizePathStyle: {stroke: "green", opacity: 0.4}});
        }
    }

    doBuild() {
        let target;

        if(!this.workRoom) {
            return;
        }

        if(_.sum(this.creep.carry) === 0) {
            this.enterState(STATE_REFILL);
            return;
        }

        if(this.workRoom.room.controller.ticksToDowngrade < 1000) {
            this.upgradeController();
        }
        else {
            if(this.fillSpawn()) {
                return;
            }

            if(this.constructSite()) {
                return;
            }

            this.upgradeController();
        }
    }

    upgradeController() {
        let target = this.workRoom.room.controller;

        if(this.creep.pos.inRangeTo(target, 3)) {
            this.creep.upgradeController(target);
            this.creep.mover.enterStationary();
        }
        else {
            this.creep.mover.moveTo(target);
        }
    }

    constructSite() {
        let target = _.first(this.workRoom.room.find(FIND_MY_CONSTRUCTION_SITES));

        if(!target) {
            return false;
        }

        if(this.creep.pos.inRangeTo(target, 3)) {
            this.creep.build(target);
            this.creep.mover.enterStationary();
        }
        else {
            this.creep.mover.moveTo(target);
        }

        return true;
    }

    fillSpawn() {
        let target = _.first(this.workRoom.room.find(FIND_STRUCTURES).filter(
            s => s.structureType === STRUCTURE_SPAWN && s.energy < s.energyCapacity));

        if(!target) {
            target = this.creep.pos.findClosestByPath(
                this.workRoom.room.find(FIND_STRUCTURES).filter(
                    s => s.structureType == STRUCTURE_EXTENSION && s.energy < s.energyCapacity
                )
            );
        }

        if(!target) {
            return false;
        }

        if(this.creep.transfer(target, RESOURCE_ENERGY) !== OK) {
            this.creep.mover.moveTo(target);
        }

        return true;
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager) {
        let body = [MOVE, MOVE, CARRY, CARRY, WORK];

        if(manager.room.energyCapacityAvailable > 1000) {
            body = bb.build([WORK, CARRY, MOVE], 700);
        }

        return {
            body: body,
            name: 'settler',
            memo: {'mind': 'settler'}
        };
    }
}

profiler.registerClass(SettlerMind, SettlerMind.name);

module.exports = {
    SettlerMind
};