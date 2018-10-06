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

    result.push({
        damage: 600,
        pos: towerPos,
    });

    return result;
}

function costMatrixForHealer(healPower, maps, roomName) {
    let costs = new PathFinder.CostMatrix();

    // maps.getCostMatrix(roomName, costs);

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
            maxRooms: 32,
            maxOps: 43000,
            roomCallback: (name) => costMatrixForHealer(300, maps, name)
        });

        utils.debugPath(path.path);
    },

    debugFun3(roomName) {
        let timer = new utils.Timer().start();

        let data = maps.getRoomCache(roomName);
        let towers = data.findStructures(STRUCTURE_TOWER);

        let matrixes = [];

        for(let tower of towers) {
            let dmgMap = damageMapForTower(tower.pos);

            let towerMatrix = new utils.DataMatrix();
            matrixes.push(towerMatrix);

            for(let dmg of dmgMap) {
                towerMatrix.set(dmg.pos.x, dmg.pos.y, dmg.damage);
            }

            utils.iterRoomPoints((x, y) => {
                towerMatrix.set(x, y, towerMatrix.get(x, y) || 150);
            });
        }

        let finalMatrix = new utils.DataMatrix();

        utils.iterRoomPoints((x, y) => {
            let totalDmg = 0;
            for(let matrix of matrixes) {
                totalDmg += matrix.get(x, y);
            }

            finalMatrix.set(x, y, totalDmg);
        });

        let visual = new RoomVisual(roomName);

        utils.iterRoomPoints((x, y) => {
            visual.text(finalMatrix.get(x, y), x, y, {font: 0.3});
        });

        console.log('DebugFun3 done in', timer.stop());
    },
};