let mind = require('mind.common');

const profiler = require('profiler');

const STATE = {
    IDLE: 'idle',
    ATTACK: 'attack'
};

class RangedDefenderMind extends mind.CreepMindBase {
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

        this.creep.heal(this.creep);

        if(this.creep.room.name != roomName) {
            let direction = this.creep.room.findExitTo(roomName);
            let exit = this.creep.pos.findClosestByRange(direction);
            this.creep.moveTo(exit);
        }
        else {
            if(this.getTarget()) {
                this.enterState(STATE.ATTACK);
            }
            if(!this.creep.pos.inRangeTo(this.creep.room.controller, 5)) {
                this.creep.moveTo(this.creep.room.controller);
            }
        }
    }

    pickTarget() {
    }

    getTarget() {
        if(!this.workRoom) {
            return;
        }

        let target = this.workRoom.threat.getClosestEnemy(this.creep);

        if(!target) {
            target = _.first(this.workRoom.room.find(FIND_HOSTILE_STRUCTURES).filter(s => s.structureType !== STRUCTURE_CONTROLLER));
        }

        return target;
    }

    attackTarget() {

        let target = this.getTarget();

        if(!target) {
            this.enterState(STATE.IDLE);
            return;
        }

        this.creep.room.visual.line(this.creep.pos, target.pos, {color: "red"});

        let result = this.creep.rangedAttack(target);

        if(result == ERR_NOT_IN_RANGE) {
            this.creep.moveTo(target);
        }
        else {
            if(this.creep.pos.getRangeTo(target) < 3) {
                let dir = this.getReverseDirection(this.creep, target);
                this.creep.move(dir);
            }
        }

        this.creep.heal(this.creep);
    }

    getReverseDirection(creep, target) {
        let dir = creep.pos.getDirectionTo(target);

        if(dir == LEFT) return RIGHT;
        if(dir == TOP_LEFT) return BOTTOM_RIGHT;
        if(dir == TOP) return BOTTOM;
        if(dir == TOP_RIGHT) return BOTTOM_LEFT;
        if(dir == RIGHT) return LEFT;
        if(dir == BOTTOM_RIGHT) return TOP_LEFT;
        if(dir == BOTTOM) return TOP;
        if(dir == BOTTOM_LEFT) return TOP_RIGHT;
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager) {
        // let body = [RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK,
        //         MOVE, MOVE, HEAL];
        let body = [TOUGH,TOUGH,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL];
        return {
            body: body,
            name: 'rangedDefender',
            memo: {'mind': 'rangedDefender'}
        };
    }
}

profiler.registerClass(RangedDefenderMind, RangedDefenderMind.name);

module.exports = {
    RangedDefenderMind
};