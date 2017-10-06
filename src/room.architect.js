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
        utils.throttle(2000, () => this.planRoads());
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
    }

    /**
     * @param {RoomPosition} from
     * @param {RoomPosition} to
     */
    generateRoad(from, to) {

        let path = from.findPathTo(to, {
            ignoreCreeps: true,
        });

        for(let step of path) {
            this.manager.room.visual.circle(step, {
                fill: "red",
                opacity: 0.3
            });

            this.manager.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
        }
    }
}

module.exports = {
    RoomArchitect
};