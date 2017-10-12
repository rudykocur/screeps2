let mind = require('mind.common');

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

        this.creep.heal();

        if(this.workRoom && this.workRoom.enemies.length > 0) {
            this.creep.moveTo(_.first(this.workRoom.enemies));
            this.enterState(STATE.ATTACK);

            return;
        }

        if(this.creep.room.name != roomName) {
            let direction = this.creep.room.findExitTo(roomName);
            let exit = this.creep.pos.findClosestByRange(direction);
            this.creep.moveTo(exit);
        }
        else {
            if(!this.creep.pos.inRangeTo(this.creep.room.controller, 5)) {
                this.creep.moveTo(this.creep.room.controller);
            }
        }
    }

    pickTarget() {
    }

    attackTarget() {
        let target = this.creep.pos.findClosestByRange(this.workRoom.enemies);

        if(!target) {
            this.enterState(STATE.IDLE);
            return;
        }
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

        this.creep.heal();
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
        return {
            body: [RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK,
                MOVE, MOVE, HEAL],
            name: 'rangedDefender',
            memo: {'mind': 'rangedDefender'}
        };
    }
}

module.exports = {
    RangedDefenderMind
};