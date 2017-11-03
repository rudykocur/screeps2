let _ = require('lodash');
let mind = require('mind.common');
let maps = require('maps');
const bb = require('utils.bodybuilder');

const profiler = require('profiler');

const STATE = {
    IDLE: 'idle',
    LURK: 'lurk',
    HUNT: 'hunt'
};

class SKHunterMind extends mind.CreepMindBase {
    /**
     *
     * @param creep
     * @param {RoomManager} roomManager
     */
    constructor(creep, roomManager) {
        super(creep, roomManager);

        this.setStateMachine({
            [STATE.IDLE]: {
                onTick: this.gotoRoom.bind(this)
            },
            [STATE.LURK]: {
                onEnter: this.pickNextLair.bind(this),
                onTick: this.gotoNearLair.bind(this),
            },
            [STATE.HUNT]: {
                onTick: this.attackTarget.bind(this)
            }
        }, STATE.IDLE);
    }

    gotoRoom() {
        let roomName = this.creep.memory.roomName;

        if(this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
        }

        if(this.creep.pos.roomName != roomName) {
            let cache = maps.getRoomCache(roomName);
            this.creep.mover.moveTo(_.first(cache.find(FIND_MINERALS)));
        }
        else {
            this.enterState(STATE.LURK);
            this.creep.enterRoom();

            // this.pickNextLair({});
        }
    }

    pickNextLair(state) {
        let lair = this.creep.pos.findClosestByPath(this.workRoom.lairs.filter(lair => !lair.ticksToSpawn));

        if(!lair) {
            lair = _.first(_.sortBy(this.workRoom.lairs, 'ticksToSpawn'));
        }

        this.debug('LAIR', lair);

        if(lair) {
            state.lairId = lair.id;

            let keeper = _.first(lair.pos.findInRange(this.workRoom.threat.enemies, 5));

            if(keeper) {
                this.enterState(STATE.HUNT, {keeperId: keeper.id});
            }
        }
    }

    gotoNearLair(state) {
        // this.debug('goto lair', state.lairId);

        let lair = Game.getObjectById(state.lairId);

        if(!lair) {
            this.enterState(STATE.IDLE);
            return;
        }

        if(this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
        }

        if(this.creep.pos.getRangeTo(lair) > 3) {
            this.creep.moveTo(lair);
        }
        else {
            let keeper = _.first(lair.pos.findInRange(this.workRoom.threat.enemies, 5));

            if(keeper) {
                this.enterState(STATE.HUNT, {keeperId: keeper.id});
            }
        }
    }

    attackTarget(state) {
        let target = Game.getObjectById(state.keeperId);

        if(!target) {
            this.enterState(STATE.LURK);
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
                this.creep.mover.exitStationary();
            }
            else {
                this.creep.mover.enterStationary();
            }
        }

        if(this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
        }
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

        let body = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,
            MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,
            RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,
            RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,
            RANGED_ATTACK,HEAL,HEAL,HEAL,HEAL,HEAL];

        return {
            body: body,
            name: 'sk-hunter',
            memo: {'mind': 'sk-hunter'}
        };
    }
}

profiler.registerClass(SKHunterMind, SKHunterMind.name);

module.exports = {
    SKHunterMind
};