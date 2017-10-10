const utils = require('utils');

class RoomArchitect {
    /**
     *
     * @param {RoomManager} manager
     */
    constructor(manager) {
        this.manager = manager;
    }

    update() {
        utils.throttle(1000, () => this.planRoads())();
    }

    planRoads() {
        let roads = [];

        let storagePos = this.manager.storage.target.pos;

        for(let source of this.manager.sources) {
            this.generateRoad(source.pos, storagePos);
        }

        for(let spawn of this.manager.spawns) {
            this.generateRoad(spawn.pos, storagePos);
        }

        for(let cluster of this.manager.extensionsClusters) {
            this.generateRoad(cluster.center, storagePos);
        }

        this.generateRoad(this.manager.room.controller.pos, storagePos);

        for(let handler of this.manager.remote.handlers) {
            for(let source of handler.sources) {
                this.generateRoad(source.pos, storagePos);
            }
        }
    }

    /**
     * @param {RoomPosition} from
     * @param {RoomPosition} to
     */
    generateRoad(from, to) {

        let path = PathFinder.search(from, {pos: to, range: 1}, {
            plainCost: 2,
            swampCost: 5,
            roomCallback: (roomName) => {
                let room = Game.rooms[roomName];
                if(!room) {
                    return;
                }

                let costs = new PathFinder.CostMatrix;

                room.find(FIND_STRUCTURES).forEach(function(struct) {
                  if (struct.structureType === STRUCTURE_ROAD) {
                    // Favor roads over plain tiles
                    costs.set(struct.pos.x, struct.pos.y, 1);
                  } else if (OBSTACLE_OBJECT_TYPES.indexOf(struct.structureType) >= 0) {
                    // Can't walk through non-walkable buildings
                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                  }
                });

                return costs;
            }
        });

        for(let step of path.path) {
            let room = Game.rooms[step.roomName];
            room.visual.circle(step, {
                fill: "red",
                opacity: 0.3
            });

            room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
        }
    }
}

module.exports = {
    RoomArchitect
};