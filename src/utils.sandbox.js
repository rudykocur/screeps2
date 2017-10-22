var _ = require("lodash");

const maps = require('maps');
const utils = require('utils');

function damageMapForTower(towerPos) {
    let result = [];

    let points = utils.getAround(towerPos, 20);
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

    debugFun() {
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

        let points = utils.getAround(target.pos, 20);
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

    debugFun2() {
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
    },

    debugFun3() {
        let roomName = 'W35N59';
        let towers = maps.getRoomCache(roomName).findStructures(STRUCTURE_TOWER);

        let matrix = {};

        for(let tower of towers) {
            let dmgMap = damageMapForTower(tower.pos);

            for(let dmg of dmgMap) {
                let key = `${dmg.pos.x}-${dmg.pos.y}`;
                matrix[key] = dmg.damage + (matrix[key] || 150);
            }
        }

        let visual = new RoomVisual(roomName);

        for(let x = 0; x < 50; x++) {
            for(let y = 0; y < 50; y++) {
                let dmg = matrix[x+'-'+y];

                if(!dmg) {
                    dmg = 150 * towers.length;
                }

                visual.text(dmg, x, y, {font: 0.3});
            }
        }
    },
};