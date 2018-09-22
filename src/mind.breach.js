var _ = require('lodash');
let mind = require('mind.common');
let maps = require('maps');
const bb = require('utils.bodybuilder');
const utils = require('utils');

const profiler = require('profiler');

const STATE = {
    IDLE: 'idle',
    ATTACK: 'attack',
    BOOST: 'boost',
};

class BreachMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        this.setStateMachine({
            [STATE.IDLE]: {
                onTick: this.gotoRoom.bind(this)
            },
            [STATE.BOOST]: {
                onTick: this.boostSelf.bind(this)
            },
            [STATE.ATTACK]: {
                onEnter: this.pickTarget.bind(this),
                onTick: this.attackTarget.bind(this)
            }
        }, STATE.IDLE);
    }

    boostSelf() {
        let roomMgr = this.creep.room.manager;
        if(!roomMgr.labs) {
            this.warn('There is no labs in', roomMgr);
        }

        if(this.creep.memory.boosts.length === 0) {
            this.important('All parts boosted. Onwards!!');
            this.enterState(STATE.IDLE);
            return;
        }

        let toBoost = this.creep.memory.boosts[0];

        let lab = _.first(roomMgr.labs.labs.filter(lab => lab.mineralType === toBoost));

        if(!lab) {
            this.warn('There is no lab loaded with', toBoost);
        }

        if(!this.creep.pos.isNearTo(lab)) {
            this.creep.mover.moveTo(lab);
        }
        else {
            let result = lab.boostCreep(this.creep);
            if(result === OK) {
                this.debug('Parts boosted with', toBoost);
                this.creep.memory.boosts.splice(0, 1);
            }
        }
    }

    gotoRoom() {
        if(this.creep.memory.boosts && this.creep.memory.boosts.length > 0) {
            this.debug('Entering boost state');
            this.enterState(STATE.BOOST);
            return;
        }

        let roomName = this.creep.memory.roomName;

        if(this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
        }

        if(this.creep.pos.roomName != roomName) {
            let cache = maps.getRoomCache(roomName);
            if(cache) {
                this.creep.mover.moveByPath(cache.controller.pos, () =>{
                    return maps.getMultiRoomPath(this.creep.pos, cache.controller.pos, {
                        avoidHostile: false,
                    });
                })
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

            let pos = this.workRoom.flag.pos;

            if(!this.creep.pos.isEqualTo(pos)) {
                this.creep.mover.moveTo(pos);
            }
            else {
                this.creep.mover.enterStationary();
            }
        }
    }

    getTarget() {
        // let target = this.workRoom.threat.getClosestEnemy(this.creep);
        let target = this.creep.pos.findClosestByPath(this.workRoom.threat.getCombatCreeps());
        let room = this.workRoom.room;

        if(!target) {
            let structures = room.find(FIND_HOSTILE_STRUCTURES).filter(
                s => s.structureType !== STRUCTURE_CONTROLLER /*&& s.structureType !== STRUCTURE_STORAGE*/);

            if(!target) {
                target = _.first(structures.filter(s => s.structureType == STRUCTURE_SPAWN));
            }

            if(!target) {
                target = _.first(structures.filter(s => s.structureType == STRUCTURE_TOWER));
            }

            if(!target) {
                target = _.first(structures.filter(s => s.structureType == STRUCTURE_STORAGE));
            }

            if(!target) {
                target = _.first(structures.filter(s => s.structureType == STRUCTURE_TERMINAL));
            }

            if(!target) {
                target = this.workRoom.threat.getClosestEnemy(this.creep);
            }

            if(!target) {
                target = _.first(structures.filter(s => s.structureType == STRUCTURE_EXTENSION));
            }

            if(!target) {
                target = _.first(structures);
            }

            if(!target) {
                target = this.creep.pos.findClosestByRange(this.workRoom.threat.enemies);
            }
        }

        return target;
    }

    pickTarget() {
    }

    attackTarget() {
        this.debug = true;

        if(!this.workRoom || this.creep.pos.roomName != this.workRoom.roomName) {
            this.enterState(STATE.IDLE);
            return;
        }

        maps.updateRoomCache(this.creep.room, 50);

        if(this.tryAttackController()) {
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
        }
        else {
            this.creep.mover.enterStationary();
        }

        if(this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
        }
        else {
            if(this.creep.pos.isNearTo(target)) {
                this.creep.attack(target);
            }
        }

        this.creep.rangedAttack(target);


    }

    tryAttackController() {
        if(this.creep.getActiveBodyparts(CLAIM) === 0) {
            return false;
        }

        let ctrl = this.workRoom.room.controller;

        if(ctrl.upgradeBlocked > 100) {
            return false;
        }

        if(this.creep.pos.isNearTo(ctrl)) {
            this.creep.attackController(ctrl);
        }
        else {
            this.goNearTarget(ctrl);
            this.creep.room.visual.line(this.creep.pos, ctrl.pos, {color:"green"});
        }

        if(this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
        }

        return true;
    }

    goNearTarget(target) {
        let path = this.creep.room.findPath(this.creep.pos, target.pos, {
            ignoreDestructibleStructures: true,
            costCallback: (roomName, matrix) => {
                let room = maps.getRoomCache(roomName);

                if(!room) {
                    return matrix;
                }

                room.find(FIND_STRUCTURES).forEach(struct => {
                    let r = Game.rooms[roomName];

                    let cost = 1;

                    if(struct.structureType === STRUCTURE_RAMPART || struct.structureType === STRUCTURE_WALL) {
                        cost = 30;
                    }

                    if(cost) {
                        if(r) {
                            // r.visual.text('c:'+cost, struct.pos.x, struct.pos.y, {color: 'red'});
                        }

                        matrix.set(struct.pos.x, struct.pos.y, cost);
                    }
                });

                return matrix;
            }
        });

        if( path.length ) {
            // utils.debugPath(path);

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
        options = _.defaults(options || {}, {withBoosts: true});

        let body = Memory.siegeCreep.body;

        let boosts;
        if(options.withBoosts) {
            boosts = Memory.siegeCreep.boosts;
        }
        else {
            body = [TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,
                MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK,
                RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,HEAL,HEAL,HEAL,HEAL];
            // boosts = Memory.siegeCreep.boosts
            boosts = [];
        }

        return {
            body: body,
            name: 'breach',
            memo: {
                mind: 'breach',
                boosts: boosts,
                withBoosts: options.withBoosts,
            }
        };
    }
}

profiler.registerClass(BreachMind, BreachMind.name);

module.exports = {
    BreachMind
};