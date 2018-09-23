var _ = require('lodash');
let mind = require('mind.common');
let maps = require('maps');
const bb = require('utils.bodybuilder');

const profiler = require('profiler');

const STATE = {
    IDLE: 'idle',
    ATTACK: 'attack'
};

class DefenderMind extends mind.CreepMindBase {
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
            [STATE.ATTACK]: {
                onEnter: this.pickTarget.bind(this),
                onTick: this.attackTarget.bind(this)
            }
        }, STATE.IDLE);
    }

    gotoRoom() {
        let roomName = this.creep.memory.roomName;

        this.creep.heal(this.creep);

        if(this.creep.pos.roomName != roomName) {
            let cache = maps.getRoomCache(roomName);
            if(cache) {
                this.creep.mover.moveTo(cache.controller.pos);
            }
            else {
                let exitDir = this.creep.room.findExitTo(roomName);
                let exit = this.creep.pos.findClosestByRange(exitDir);
                this.creep.moveTo(exit);
            }
        }
        else {
            if(this.getTarget()) {
                this.enterState(STATE.ATTACK);
            }

            let site = _.first(this.workRoom.room.find(FIND_HOSTILE_CONSTRUCTION_SITES));

            if(site) {
                if(!this.creep.pos.isEqualTo(site.pos)) {
                    this.creep.mover.moveTo(site);
                    return;
                }
            }

            let pos = this.workRoom.controller.getStandingPosition();

            if(!this.creep.pos.isEqualTo(pos)) {
                this.creep.mover.moveTo(pos);
            }
            else {
                this.creep.mover.enterStationary();
            }
        }
    }

    getTarget() {

        let target;

        if(this.workRoom.threat.getCombatCreeps().length === 0) {
            target = Game.getObjectById(this.creep.memory.lastTargetId);
        }

        if(!target) {
            target = this.workRoom.threat.getClosestEnemy(this.creep);
        }

        if(!target) {
            target = _.first(this.workRoom.room.find(FIND_HOSTILE_STRUCTURES).filter(s => s.structureType !== STRUCTURE_CONTROLLER));
        }

        if(target) {
            this.creep.memory.lastTargetId = target.id;
        }
        else {
            this.creep.memory.lastTargetId = null;
        }

        return target;
    }

    pickTarget() {
    }

    attackTarget() {
        this.debug = true;

        if(!this.workRoom) {
            this.enterState(STATE.IDLE);
            return;
        }

        let target = this.getTarget();

        if(!target) {
            this.enterState(STATE.IDLE);
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.goNearTarget(target);
            this.creep.room.visual.line(this.creep.pos, target.pos, {color:"red"});
            // this.creep.mover.moveTo(target, {visualizePathStyle: {color: "red"}, ignoreDestructibleStructures:true});

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

        if(this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
        }
    }

    goNearTarget(target) {
        let path = this.creep.room.findPath(this.creep.pos, target.pos, {
            ignoreDestructibleStructures: true,
            costCallback: (roomName, matrix) => {
                let cache = maps.getRoomCache(roomName);

                if(!cache) {
                    return matrix;
                }

                cache.find().forEach(struct => {
                    let r = Game.rooms[roomName];

                    let cost;

                    if(struct.structureType === STRUCTURE_RAMPART) {
                        cost = 30;
                    }

                    if(cost) {
                        if(r) {
                            r.visual.text('c:'+cost, struct.pos.x, struct.pos.y, {color: 'red'});
                        }
                        matrix.set(struct.x, struct.y, cost);
                    }
                });

                return matrix;
            }
        });

        if( path.length ) {
            let step = path[0];
            this.creep.room.visual.circle(step.x, step.y, {
                color: 'blue',
            });
            let struct = _.first(RoomPosition.asPosition(step, this.creep.room.name)
                .lookFor(LOOK_STRUCTURES).filter(s => s.structureType !== STRUCTURE_ROAD));
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
    static getSpawnParams(manager, options) {
        options = options || {};

        let body = [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK];
        if(manager.room.energyCapacityAvailable > 1000) {
            body = [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK];
        }

        if(manager.room.energyCapacityAvailable > 3000) {
            body = [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,
                ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,
                RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,HEAL,HEAL];
        }

        if(options.breach) {
            body = bb.build([ATTACK, ATTACK, MOVE], manager.room.energyCapacityAvailable,
                [], [RANGED_ATTACK, MOVE]);
        }

        return {
            body: body,
            name: 'defender',
            memo: {'mind': 'defender'}
        };
    }
}

profiler.registerClass(DefenderMind, DefenderMind.name);

module.exports = {
    DefenderMind
};