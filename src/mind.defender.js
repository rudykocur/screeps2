let _ = require('lodash');
let mind = require('mind.common');
let maps = require('maps');
const bb = require('utils.bodybuilder');

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

        this.creep.heal(this.creep);

        if(this.creep.pos.roomName != roomName) {
            let room = maps.getRoomCache(roomName);
            this.creep.mover.moveTo(room.controller.pos);
        }
        else {
            if(this.workRoom.enemies.length > 0 || this.workRoom.hostileStructures.length > 0) {
                this.enterState(STATE.ATTACK);
            }

            let site = _.first(this.workRoom.room.find(FIND_HOSTILE_CONSTRUCTION_SITES));

            if(site) {
                if(!this.creep.pos.isEqualTo(site.pos)) {
                    this.creep.mover.moveTo(site);
                    return;
                }
            }

            if(!this.creep.pos.inRangeTo(this.creep.room.controller, 5)) {
                this.creep.mover.moveTo(this.creep.room.controller);
            }
            else {
                this.creep.mover.enterStationary();
            }
        }
    }

    pickTarget() {
        let target = _.first(this.workRoom.enemies);

        if(!target) {
            target = _.first(this.workRoom.hostileStructures);
        }

        if(!target) {
            this.enterState(STATE.IDLE);
        }

        this.localState.targetId = target.id;
    }

    attackTarget() {
        this.debug = true;

        let target = this.creep.pos.findClosestByRange(this.workRoom.enemies);

        if(!target) {
            target = _.first(this.workRoom.hostileStructures);
        }

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

        this.creep.heal(this.creep);
    }

    goNearTarget(target) {
        let path = this.creep.room.findPath(this.creep.pos, target.pos, {
            ignoreDestructibleStructures: true,
            costCallback: (roomName, matrix) => {
                let room = maps.getRoomCache(roomName);

                room.find().forEach(struct => {
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
            let struct = _.first(new RoomPosition(step.x, step.y, this.creep.room.name)
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

module.exports = {
    DefenderMind
};