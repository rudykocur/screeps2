var _ = require('lodash');
const utils = require('utils');
const maps = require('maps');

const profiler = require('profiler');

class CreepCommonActions {

    constructor(creep, roomManager) {
        // this.mind = mind;
        this.creep = creep;
        this.workRoom = roomManager;

        // this.hander = handler;
        // this.creep = creep;
        // this.workRoom = workRoom;
    }

    /**
     * @param [options] Options
     * @param [options.onDone] callback invoked after transfer
     * @param [options.onTick] callback invoked in each tick
     * @param [options.storage] Storage where unload to
     * @param [options.pathOptions] Additional options passed to path calculation
     */
    unloadAllResources(options) {
        options = _.defaults(options || {}, {
            onDone: () => {},
            onTick: () => {},
            storage: this.workRoom.storage,
            pathOptions: {},
        });

        options.onTick();



        if(!options.storage.canDeposit(this.creep)) {
            this.creep.mover.moveByPath(() =>{
                return maps.getMultiRoomPath(this.creep.pos, options.storage.target.pos, options.pathOptions);
            })
        }
        else {
            let toUnload = _.keys(_.pick(this.creep.carry, amount => amount > 0));

            let result = null;
            if(toUnload.length > 0) {
                result = options.storage.deposit(this.creep);
            }

            if((toUnload.length === 1 && result === OK) || toUnload.length === 0) {
                options.onDone();
                this.creep.mover.enterStationary();
            }
        }
    }

    /**
     * @param resource
     * @param [options] Options
     * @param [options.onDone] callback invoked after transfer
     */
    withdrawFromStorage(resource, options) {
        options = _.defaults(options, {
            onDone: () => {},
        });

        let storage = this.workRoom.storage;

        if(!storage.isNear(this.creep)) {
            this.creep.mover.moveByPath(() =>{
                return maps.getMultiRoomPath(this.creep.pos, storage.target.pos, {});
            })
        }
        else {
            storage.withdraw(this.creep, resource);
            options.onDone();
            this.creep.mover.enterStationary();
        }
    }

    /**
     *
     * @param target
     * @param resource
     * @param {{onDone,getAmount}} options
     */
    withdrawFrom(target, resource, options) {
        options = _.defaults(options, {
            onDone: () => {},
            getAmount: () => undefined
        });

        if(_.isString(target)) {
            target = Game.getObjectById(target);
        }

        if(!target) {
            options.onDone();
            this.creep.mover.enterStationary();
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.mover.moveByPath(() =>{
                return maps.getMultiRoomPath(this.creep.pos, target.pos, {});
            })
        }
        else {
            this.creep.withdraw(target, resource, options.getAmount());

            options.onDone();
            this.creep.mover.enterStationary();
        }
    }

    /**
     * @param target
     * @param resource
     * @param [options] Options
     * @param [options.onDone] callback invoked after transfer
     */
    transferInto(target, resource, options) {
        options = _.defaults(options, {onDone: () => {}});

        if(_.isString(target)) {
            target = Game.getObjectById(target);
        }

        if(!target) {
            options.onDone();
            this.creep.mover.enterStationary();
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.mover.moveByPath(() =>{
                return maps.getMultiRoomPath(this.creep.pos, target.pos, {});
            })
        }
        else {
            this.creep.transfer(target, resource);
            options.onDone();
            this.creep.mover.enterStationary();
        }
    }

    isEnoughStoredEnergy(minThreshold) {
        minThreshold = minThreshold || 0;
        return (this.workRoom.storage.getStoredEnergy() - minThreshold) > this.creep.carryCapacity/2;
    }

    // refillFromStorage(nextState, idleState, minThreshold) {
    //     if(!this.isEnoughStoredEnergy(minThreshold)) {
    //         this.mind.enterState(idleState);
    //         return;
    //     }
    //
    //     if(this.workRoom.storage.isNear(this.creep)) {
    //         this.workRoom.storage.withdraw(this.creep);
    //         this.mind.enterState(nextState);
    //     }
    //     else {
    //         this.creep.mover.moveTo(this.workRoom.storage.target);
    //     }
    // }

    pickOffRoadPosition(target, range) {
        if(!utils.hasRoad(this.creep.pos)) {
            console.log(this.creep, '::', this.creep.pos, '::', 'ALREADY OUT OF ROAD');
            return true;
        }

        let points = utils.getPositionsAround(this.creep.pos);

        for(let point of points) {
            if(target.getRangeTo(point) <= range) {
                if(!utils.hasRoad(point) && this.isEmpty(point)) {
                    if(this.creep.mover.moveTo(point) === OK) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * @param {RoomPosition} pos
     */
    isEmpty(pos) {
        if(Game.map.getTerrainAt(pos) === 'wall') {
            return false;
        }

        if(pos.lookFor(LOOK_STRUCTURES).filter(s => OBSTACLE_OBJECT_TYPES.indexOf(s.structureType) >= 0).length > 0) {
            return false;
        }

        if(pos.lookFor(LOOK_CREEPS).length > 0) {
            return false;
        }

        return true;
    }


    gotoMeetingPoint() {
        let point;
        if(this.workRoom.isRemote) {
            point = this.workRoom.parent.meetingPoint.pos;
        }
        else {
            point = this.workRoom.meetingPoint.pos;
        }

        if(!point) {
            return;
        }

        if(!point.inRangeTo(this.creep, 2)) {
            this.creep.mover.moveTo(point);
        }
        else {
            let creep = this.creep;
            let t1 = creep.memory.roomName.substr(0, 3);
            let t2 = creep.memory.roomName.substr(3, 3);
            creep.room.visual.text(t1, creep.pos, {font: '8px', stroke: 'black'});
            creep.room.visual.text(t2, creep.pos.x, creep.pos.y + 0.5, {font: '8px', stroke: 'black'});
            this.creep.mover.enterStationary();
        }
    }
}

module.exports = {
    CreepCommonActions
};