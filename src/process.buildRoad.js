var _ = require('lodash');

const procbase = require('process.base');
const procmgr = require('process.manager');

const utils = require('utils');
const maps = require('maps');

class BuildRoad extends procbase.ProcessBase {

    /**
     * @param {RoomPosition} from
     * @param {RoomPosition} to
     * @param {Object} options
     */
    static factory(from, to, options) {
        return new BuildRoad('build-road-' + from.serialize() + '-to-'+to.serialize(), {
            from: from.serialize(),
            to: to.serialize(),
            options: options || {},
        })
    }

    *run() {

        let from = RoomPosition.unserialize(this.state.from);
        let to = RoomPosition.unserialize(this.state.to);
        let options = _.defaults(this.state.options, {
            targetRange: 1,
            cutoffRange: 0,
            withTarget: false,
        });

        let path = PathFinder.search(from, {pos: to, range: options.targetRange}, {
            plainCost: 2,
            swampCost: 5,
            roomCallback: (roomName) => {
                let room = Game.rooms[roomName];

                let costs = new PathFinder.CostMatrix;

                costs = maps.blockHostileRooms(roomName, costs);

                if(!costs) {
                    return false;
                }

                maps.getCostMatrix(roomName, costs);

                if(room) {
                    room.find(FIND_CONSTRUCTION_SITES).forEach(/**ConstructionSite*/site => {
                        if(site.structureType === STRUCTURE_ROAD) {
                            costs.set(site.pos.x, site.pos.y, 1);
                        }
                    });
                    let /**RoomManager*/ mgr = room.manager;
                    if(!mgr) {
                        this.err('No manager for room', room);
                        return costs;
                    }

                    let allStructs = [].concat(mgr.data.spawns, mgr.data.extensions, mgr.data.links,
                        mgr.data.towers, mgr.data.containers);
                    if(mgr) {
                        for(let struct of allStructs) {
                            costs.set(struct.pos.x, struct.pos.y, 0xFF);
                        }
                    }
                }


                return costs;
            }
        });

        if(options.cutoffRange) {
            path.path = path.path.slice(0, options.cutoffRange);
        }

        for(let step of path.path) {
            if (from.isEqualTo(step)) {
                continue;
            }

            if(!options.withTarget && to.isEqualTo(step)) {
                continue;
            }

            let room = Game.rooms[step.roomName];

            if (!room) {
                this.err('Cannot place road in room', step.roomName);
                continue;
            }

            let visual = new RoomVisual(step.roomName);
            visual.circle(step, {
                fill: "red",
                opacity: 0.7
            });

            room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
        }
    }

    toString() {
        return `[BuildRoad ${this.state.from} to ${this.state.to}]`;
    }
}

procmgr.registerProcessType(BuildRoad);

module.exports = {
    BuildRoad
};