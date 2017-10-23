var _ = require('lodash');
const utils = require('utils');
const flags = require('utils.flags');
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

        if(this.manager.data.extensions.length < availableExtensions) {
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

            if(!pointInPath) {
                this.err('NO POINT IN PATH', pointInPath, '::', this.manager.storage, '::', this.manager.storage.target);
            }

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
        for(let flag of this.manager.flags.filter(flags.isTower)) {
            if(OK === room.createConstructionSite(flag.pos, STRUCTURE_TOWER)) {
                flag.remove();
            }
        }
    }

    buildStorage(room) {
        let pos = this.manager.storage.target.pos;
        let around = utils.getPositionsAround(pos);

        for(let p of around) {
            room.createConstructionSite(p, STRUCTURE_STORAGE);
        }
    }

    planRoads() {
        let roads = [];

        let storagePos = this.manager.storage.target.pos;

        for(let source of this.manager.data.sources) {
            this.generateRoad(source.pos, storagePos);
        }

        for(let spawn of this.manager.data.spawns) {
            this.generateRoad(spawn.pos, storagePos);
        }

        for(let cluster of this.manager.extensionsClusters) {
            this.generateRoad(cluster.center, storagePos);
        }

        this.generateRoad(this.manager.room.controller.pos, storagePos);

        for(let handler of this.manager.remote.handlers) {
            if(!handler.data) {
                continue;
            }

            for(let source of handler.data.sources) {
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

            if(!room) {
                this.err('Cannot place road in room', step.roomName);
                continue;
            }

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