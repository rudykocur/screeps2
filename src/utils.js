var _ = require("lodash");

class Timer {
    constructor() {
        this.usedTime = 0;
        this.usedTimeStart = 0;
    }

    start() {
        this.usedTimeStart = Game.cpu.getUsed();
    }

    count(callback) {
        this.start();
        callback();
        this.stop();
    }

    stop() {
        this.usedTime += Game.cpu.getUsed() - this.usedTimeStart;
    }
}

class CompoundTimer {
    constructor(timers) {
        this.timers = timers;
    }

    get usedTime() {
        return _.sum(this.timers, t => t.usedTime);
    }
}

class Executable {
    constructor() {
        this.updateTime = null;
        this.timer = new Timer();
    }

    update() {}

    run() {
        try{
            let tStart = Game.cpu.getUsed();
            this.update();
            this.updateTime = Game.cpu.getUsed() - tStart;
        }
        catch(e) {
            console.log('Executable failed:', this, '::', e, 'Stack trace:', e.stack);
            Game.notify(`Executable failed: ${this} :: ${e}. Stack trace: ${e.stack}`, 5);
        }
    }

    err(...messages) {
        messages.unshift('[ERROR] '+this+': ');

        console.log.apply(console, messages);
    }
}

function damageMapForTower(towerPos) {
    let result = [];

    let points = module.exports.getAround(towerPos, 20);
    for(let point of points) {
        let distance = towerPos.getRangeTo(point);
        let dmg;
        if(distance <= TOWER_OPTIMAL_RANGE) {
            dmg = 600;
        }
        else if(distance < TOWER_FALLOFF_RANGE) {
            let ratio = distance - TOWER_OPTIMAL_RANGE;
            let decrease = ratio * 30;

            dmg = Math.round(TOWER_POWER_ATTACK - decrease);
        }
        else {
            dmg = TOWER_POWER_ATTACK * (1-TOWER_FALLOFF);
        }

        dmg = Math.round(dmg);

        result.push({
            damage: dmg,
            pos: point,
        });
    }

    return result;
}

function costMatrixForHealer(healPower, maps, roomName) {
    let costs = new PathFinder.CostMatrix();

    maps.getCostMatrix(roomName, costs);

    let cache = maps.getRoomCache(roomName);

    if(cache) {
        let towers = cache.findStructures(STRUCTURE_TOWER);

        for (let tower of towers) {
            let damages = damageMapForTower(tower.pos);
            for (let dmgData of damages) {
                if (dmgData.damage > healPower) {
                    costs.set(dmgData.pos.x, dmgData.pos.y, 0xff);
                }
                else if (dmgData.damage + 100 > healPower) {
                    costs.set(dmgData.pos.x, dmgData.pos.y, 15);
                }
            }
        }
    }

    return costs;
}

module.exports = {
    Executable, Timer, CompoundTimer,

    throttle(ticks, callback) {
        return () => {
            if (Game.time % ticks === 0) {
                callback();
            }
        }

    },

    every(ticks, callback) {
        if (Game.time % ticks === 0) {
            callback();
        }
    },

    round (number, precision) {
        let factor = Math.pow(10, precision);
        let tempNumber = number * factor;
        let roundedTempNumber = Math.round(tempNumber);
        return roundedTempNumber / factor;
    },

    myUsername() {
        let myRoom = _.first(_.filter(Game.rooms, r => r.controller && r.controller.my));

        return myRoom.controller.owner.username;
    },

    /**
     * @param {RoomPosition} center
     */
    getPositionsAround(center) {
        return [
            new RoomPosition(center.x -1, center.y -1, center.roomName),
            new RoomPosition(center.x -1, center.y, center.roomName),
            new RoomPosition(center.x -1, center.y +1, center.roomName),
            new RoomPosition(center.x, center.y -1, center.roomName),
            new RoomPosition(center.x, center.y +1, center.roomName),
            new RoomPosition(center.x +1, center.y -1, center.roomName),
            new RoomPosition(center.x +1, center.y, center.roomName),
            new RoomPosition(center.x +1, center.y +1, center.roomName),
        ];
    },

    getAround(center, radius) {
        let result = [];

        for(let i = radius*-1; i <= radius; i++) {
            for(let j = radius*-1; j <= radius; j++) {
                if(i === 0 && j === 0) {
                    continue;
                }

                let x = center.x + i;
                let y = center.y + j;



                if(x < 1 || x > 49 || y < 1 || y > 49) {
                    continue;
                }

                result.push(new RoomPosition(x, y, center.roomName));
            }
        }

        return result;
    },

    reverseReactions(reactions) {
        let results = {};

        _.each(reactions, (other, firstResource) => {
            _.each(other, (finalResource, secondResource) => {
                if(finalResource in results) {
                    return;
                }
                results[finalResource] = [firstResource, secondResource];
            })
        });

        return results;
    },

    getNextReaction(resource, amount, store) {

        store = _.omit(store, resource);

        if((store[resource] || 0) > amount) {
            return null;
        }

        let toCheck = [REACTIONS_REVERSE[resource]];

        while(toCheck.length > 0) {
            let reaction = toCheck.pop();

            if((store[reaction[0]] || 0) < amount && RESOURCES_BASE.indexOf(reaction[0]) < 0) {
                toCheck.push(REACTIONS_REVERSE[reaction[0]]);
                continue;
            }

            if((store[reaction[1]] || 0) < amount && RESOURCES_BASE.indexOf(reaction[1]) < 0) {
                toCheck.push(REACTIONS_REVERSE[reaction[1]]);
                continue;
            }

            return reaction;
        }
    },

    debugPath(path) {
        for(let step of path) {

            let visual = new RoomVisual(step.roomName);
            visual.circle(step, {
                fill: "yellow",
                opacity: 0.3
            });
        }
    },

    getPathTarget(targets, path) {
        let last = path[path.length - 1];

        for(let target of targets) {
            if(target.pos.isNearTo(last)) {
                return target;
            }
        }
    },

    debugFun(maps, utils) {
        // let from = maps.getRoomCache('W27N53').controller;
        let from = maps.getRoomCache('W35N58').controller.pos;
        let to = maps.getRoomCache('W37N58').findStructures(STRUCTURE_TOWER);

        let path = PathFinder.search(from, to.map(s=>s.pos), {
            plainCost: 2,
            swampCost: 5,
            maxOps: 3000,
            roomCallback: maps.getCostMatrix
        });

        utils.debugPath(path.path);

        let target = utils.getPathTarget(to, path.path);

        for(let step of path.path) {
            if(step.roomName != target.pos.roomName) {
                continue;
            }

            let range = step.getRangeTo(target.pos);
            if(range <= TOWER_FALLOFF_RANGE) {
                let visual = new RoomVisual(step.roomName);
                visual.circle(step, {
                    fill: "red",
                    opacity: 0.6,
                    radius: 0.5,
                });
                // visual.text(range, step);
            }
        }

        let points = module.exports.getAround(target.pos, 20);
        for(let point of points) {
            let distance = target.pos.getRangeTo(point);
            let dmg;
            if(distance <= TOWER_OPTIMAL_RANGE) {
                dmg = 600;
            }
            else if(distance < TOWER_FALLOFF_RANGE) {
                let ratio = distance - TOWER_OPTIMAL_RANGE;
                let decrease = ratio * 30;

                dmg = Math.round(TOWER_POWER_ATTACK - decrease);
            }
            else {
                dmg = TOWER_POWER_ATTACK * (1-TOWER_FALLOFF);
            }

            dmg = Math.round(dmg);

            let visual = new RoomVisual(point.roomName);
            visual.text(dmg, point, {font: 0.5});
        }

        // console.log(JSON.stringify(target));
    },

    debugFun2(maps, utils) {
        // let from = maps.getRoomCache('W27N53').controller;
        // let from = maps.getRoomCache('W35N58').controller.pos;
        let from = new RoomPosition(27, 40, 'W36N58');
        let to = maps.getRoomCache('W37N58').findStructures(STRUCTURE_SPAWN);

        // console.log('FROM', from, ':: to', to.map(s=>s.pos));

        let path = PathFinder.search(from, to.map(s=>s.pos), {
            plainCost: 2,
            swampCost: 5,
            maxOps: 13000,
            roomCallback: (name) => costMatrixForHealer(520, maps, name)
        });

        utils.debugPath(path.path);
    }
};