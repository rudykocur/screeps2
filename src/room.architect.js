var _ = require('lodash');
const utils = require('utils');
const maps = require('maps');

class RoomArchitect extends utils.Executable {
    /**
     *
     * @param {RoomManager} manager
     */
    constructor(manager) {
        super();

        this.manager = manager;
    }

    update() {
        let availableExtensions = this.getMaxStructuresCount(STRUCTURE_EXTENSION);
        let availableTowers = this.getMaxStructuresCount(STRUCTURE_TOWER);
        let availableStorages = this.getMaxStructuresCount(STRUCTURE_STORAGE);

        if(this.manager.extensions.length < availableExtensions) {
            utils.throttle(15, () => this.buildExtensions(this.manager.room))();
        }

        if(this.manager.towers.length < availableTowers) {
            utils.throttle(15, () => this.buildTowers(this.manager.room))();
        }

        if(availableStorages > 0 && !this.manager.room.storage) {
            utils.throttle(25, () => this.buildStorage(this.manager.room))();
        }

        if(this.manager.room.controller.level > 2) {
            utils.throttle(1000, () => this.planRoads())();
        }
    }

    getMaxStructuresCount(type) {
        return CONTROLLER_STRUCTURES[type][this.manager.room.controller.level]
    }

    buildExtensions(room) {
        let cluster = _.first(this.manager.extensionsClusters.filter(
            c => c.extensions.length < 7
        ));

        if(cluster) {
            let storagePath = cluster.center.findPathTo(this.manager.storage.target);

            let pointInPath = _.first(storagePath.filter(
                pos => cluster.center.getRangeTo(pos.x, pos.y) === 1
            ));

            for(let point of utils.getPositionsAround(cluster.center)) {
                if(point.isEqualTo(pointInPath.x, pointInPath.y)) {
                    continue;
                }

                room.visual.circle(point, {
                    fill: "orange",
                    opacity: 0.6
                });

                room.createConstructionSite(point.x, point.y, STRUCTURE_EXTENSION)
            }
        }
    }

    /**
     * @param {Room} room
     */
    buildTowers(room) {
        let flags = this.manager.flags.filter(utils.isTowerFlag);

        for(let flag of flags) {
            if(OK === room.createConstructionSite(flag.pos, STRUCTURE_TOWER)) {
                flag.remove();
            }
        }
    }

    buildStorage(room) {
        let pos = this.manager.storage.target.pos;

        room.createConstructionSite(pos, STRUCTURE_STORAGE);
        room.visual.circle(pos, {
            fill: "red",
            opacity: 0.8,
            radius: 1,
        });
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

                let costs = new PathFinder.CostMatrix;

                costs = maps.blockHostileRooms(roomName, costs);

                if(!costs) {
                    return false;
                }

                maps.getCostMatrix(roomName, costs);

                if(room) {
                    room.find(FIND_CONSTRUCTION_SITES).forEach(/**ConstructionSite*/site => {
                        if(site.structureType == STRUCTURE_ROAD) {
                            costs.set(site.pos.x, site.pos.y, 1);
                        }
                    });
                }


                return costs;
            }
        });

        let placedStructures = 0;

        for(let step of path.path) {
            if(from.isEqualTo(step) || to.isEqualTo(step)) {
                continue;
            }

            let room = Game.rooms[step.roomName];
            let visual = new RoomVisual(step.roomName);
            visual.circle(step, {
                fill: "red",
                opacity: 0.3
            });

            if(room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD) === OK) {
                placedStructures ++;
            }
        }

        return placedStructures;
    }

    toString() {
        return `[RoomArchitect for ${this.manager.room}]`;
    }
}

module.exports = {
    RoomArchitect
};