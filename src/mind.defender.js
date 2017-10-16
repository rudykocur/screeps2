let _ = require('lodash');
let mind = require('mind.common');
let maps = require('maps');

const STATE = {
    IDLE: 'idle',
    ATTACK: 'attack'
};

class DefenderMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        this.setStateMachine({
            [STATE.IDLE]: {
                onTick: this.gotoRoom.bind(this)
            },
            [STATE.ATTACK]: {
                onEnter: this.pickTarget.bind(this),
                onTick: this.attackTarget.bind(this)
            }
        }, STATE.IDLE);
    }

    gotoRoom() {
        let roomName = this.creep.memory.roomName;

        if(this.roomMgr.enemies.length > 0) {
            this.enterState(STATE.ATTACK);
            return;
        }

        if(this.creep.room.name != roomName) {
            let room = maps.getRoomCache(roomName);
            this.creep.mover.moveTo(room.controller.pos);
        }
        else {
            if(!this.creep.pos.inRangeTo(this.creep.room.controller, 5)) {
                this.creep.mover.moveTo(this.creep.room.controller);
            }
            else {
                this.creep.mover.enterStationary();
            }
        }
    }

    pickTarget() {
        let target = _.first(this.roomMgr.enemies);

        if(!target) {
            this.enterState(STATE.IDLE);
        }

        this.localState.targetId = target.id;
    }

    attackTarget() {
        let target = this.creep.pos.findClosestByRange(this.roomMgr.enemies);

        if(!target) {
            this.enterState(STATE.IDLE);
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.goNearTarget(target);

            // }
            // else {
            //     let x = this.creep.mover.moveTo(target, {visualizePathStyle: {color: "red"}, ignoreDestructibleStructures:true});
            // }
        }
        else {
            this.creep.mover.enterStationary();
        }

        if(this.creep.pos.isNearTo(target)) {
            this.creep.attack(target);
        }
        this.creep.rangedAttack(target);
    }

    goNearTarget(target) {
        let path = this.creep.room.findPath(this.creep.pos, target.pos, {
            maxOps: 400, ignoreDestructibleStructures: true
        });

        if( path.length ) {
            let step = path[0];
            this.creep.room.visual.circle(step.x, step.y, {
                color: 'blue',
            });
            let struct = _.first(new RoomPosition(step.x, step.y, this.creep.room.name).lookFor(LOOK_STRUCTURES));
            if (struct) {
                this.creep.attack(struct);
                return;
            }
            this.creep.move(path[0].direction);
        }
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager) {
        let body = [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK];
        if(manager.room.energyCapacityAvailable > 1000) {
            body = [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK];
        }

        return {
            body: body,
            name: 'defender',
            memo: {'mind': 'defender'}
        };
    }
}

module.exports = {
    DefenderMind
};