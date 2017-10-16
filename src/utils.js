var _ = require("lodash");

class Executable {
    update() {}

    run() {
        try{
            this.update();
        }
        catch(e) {
            console.log('Executable failed:', this, '::', e, 'Stack trace:', e.stack);
            Game.notify(`Executable failed: ${this} :: ${e}. Stack trace: ${e.stack}`, 5);
        }
    }
}

module.exports = {
    Executable,

    throttle(ticks, callback) {
        return () => {
            if (Game.time % ticks == 0) {
                callback();
            }
        }

    },

    /**
     * @param {Flag} flag
     */
    isBlockFlag(flag) {
        return flag.color === COLOR_RED && flag.secondaryColor === COLOR_RED;
    },

    isMeetingPointFlag() {

    },

    /**
     * @param {Flag} flag
     */
    isExtensionClusterFlag(flag) {
        return flag.color === COLOR_YELLOW && flag.secondaryColor === COLOR_YELLOW;
    },

    /**
     * @param {Flag} flag
     */
    isTowerFlag(flag) {
        return flag.color === COLOR_RED && flag.secondaryColor === COLOR_YELLOW;
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
        let from = maps.getRoomCache('W27N53').controller.pos;
        let to = maps.getRoomCache('W28N54').findStructures(STRUCTURE_TOWER);

        let path = PathFinder.search(from, to.map(s=>s.pos), {
            plainCost: 2,
            swampCost: 5,
            roomCallback: maps.getCostMatrix
        });

        utils.debugPath(path.path);

        let target = utils.getPathTarget(to, path.path);

        for(let step of path.path) {
            if(step.roomName != target.pos.roomName) {
                continue;
            }

            if(step.getRangeTo(target.pos) <= TOWER_FALLOFF_RANGE) {
                let visual = new RoomVisual(step.roomName);
                visual.circle(step, {
                    fill: "red",
                    opacity: 0.6,
                    radius: 0.5,
                });
            }
        }

        // console.log(JSON.stringify(target));
    }
};