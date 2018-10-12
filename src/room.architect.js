var _ = require('lodash');
const utils = require('utils');
const flags = require('utils.flags');
const maps = require('maps');

const profiler = require('profiler');
const procMSC = require('process.minigSiteContainer');
const procBR = require('process.buildRoad');

class RoomArchitect extends utils.Executable {
    /**
     *
     * @param {RoomManager} manager
     */
    constructor(manager) {
        super();

        this.manager = manager;
        this.id = this.manager.room.controller.id;
    }

    update() {
        let availableExtensions = this.getMaxStructuresCount(STRUCTURE_EXTENSION);
        let availableTowers = this.getMaxStructuresCount(STRUCTURE_TOWER);
        let availableStorages = this.getMaxStructuresCount(STRUCTURE_STORAGE);
        let availableSpawns = this.getMaxStructuresCount(STRUCTURE_SPAWN);
        let availableExtractors = this.getMaxStructuresCount(STRUCTURE_EXTRACTOR);
        let availableLabs = this.getMaxStructuresCount(STRUCTURE_LAB);
        let availableLinks = this.getMaxStructuresCount(STRUCTURE_LINK);
        let availableTerminals = this.getMaxStructuresCount(STRUCTURE_TERMINAL);

        if(this.manager.data.extensions.length < availableExtensions) {
            utils.every(15, () => this.buildExtensions(this.manager.room));
        }

        if(this.manager.data.spawns.length < availableSpawns) {
            utils.every(15, () => this.buildSpawns(this.manager.room));
        }

        if(this.manager.towers.length < availableTowers) {
            utils.every(15, () => this.buildTowers(this.manager.room));
        }

        if(this.manager.data.labs.length < availableLabs) {
            utils.every(50, () => this.buildLabs(this.manager.room));
        }

        if(this.manager.data.links.length < availableLinks) {
            utils.every(50, () => this.buildLinks(this.manager.room));
        }

        if(availableStorages > 0 && !this.manager.room.storage) {
            utils.every(25, () => this.buildStorage(this.manager.room));
        }

        if(availableTerminals > 0 && !this.manager.room.terminal) {
            utils.every(71, () => this.buildTerminal(this.manager.room));
        }

        if(availableExtractors > 0 && !this.manager.data.extractor) {
            utils.every(25, () => this.buildExtractor(this.manager.mineral, this.manager.room));
        }

        if(this.manager.room.controller.level > 2) {
            utils.everyMod(1000, this.id, () => this.planRoads());

            utils.everyMod(300, this.id, () => this.buildMiningSites(this.manager));
        }
    }

    getMaxStructuresCount(type) {
        return CONTROLLER_STRUCTURES[type][this.manager.room.controller.level]
    }

    buildExtensions(room) {
        let clusters = this.manager.extensionsClusters.filter(
            c => c.extensions.length < c.extensionsMax
        );

        for(let cluster of clusters) {
            let storagePath = cluster.center.findPathTo(this.manager.storage.target,{
                ignoreCreeps: true,
            });

            let pointInPath = _.first(storagePath.filter(
                pos => cluster.center.getRangeTo(pos.x, pos.y) === 1
            ));

            if(!pointInPath) {
                this.err('NO POINT IN PATH', pointInPath, '::', this.manager.storage, '::', this.manager.storage.target);
                continue;
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
    buildSpawns(room) {
        this.flagsToSites(room, flags.isSpawn, STRUCTURE_SPAWN);
    }

    /**
     * @param {Room} room
     */
    buildLinks(room) {
        this.flagsToSites(room, flags.isLink, STRUCTURE_LINK);
    }

    /**
     * @param {RoomManager} manager
     */
    buildMiningSites(manager) {
        for(let site of Object.values(manager.mines)) {
            if(!site.container) {
                manager.processManager.addProcess(procMSC.MiningSiteContainer.factory(site));
            }
        }

        for(let handler of this.manager.remote.handlers) {
            if(!handler.data) {
                continue;
            }

            for(let site of Object.values(handler.mines)) {
                if(!site.container) {
                    manager.processManager.addProcess(procMSC.MiningSiteContainer.factory(site));
                }
            }
        }
    }

    /**
     * @param {Room} room
     */
    buildTowers(room) {
        this.flagsToSites(room, flags.isTower, STRUCTURE_TOWER);
    }

    buildLabs(room) {
        this.flagsToSites(room, flags.isLab, STRUCTURE_LAB);
    }

    buildTerminal(room) {
        this.flagsToSites(room, flags.isTerminal, STRUCTURE_TERMINAL);
    }

    buildStorage(room) {
        if(this.flagsToSites(room, flags.isStorageSite, STRUCTURE_STORAGE)) {
            return;
        }

        let pos = this.manager.storage.target.pos;
        let around = utils.getPositionsAround(pos);

        for(let p of around) {
            room.createConstructionSite(p, STRUCTURE_STORAGE);
        }
    }

    /**
     *
     * @param {MineralWrapper} mineral
     * @param room
     */
    buildExtractor(mineral, room) {
        if(!mineral.container) {
            let containerPos = mineral.pickContainerPlace();

            room.visual.circle(containerPos, {});

            room.createConstructionSite(containerPos, STRUCTURE_CONTAINER);
        }
        else {
            room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
        }
    }

    planRoads() {
        let roads = [];

        let storagePos = this.manager.storage.target.pos;

        for(let source of this.manager.data.sources) {
            this.generateRoad(storagePos, source.pos, {
                cutoffRange: -1,
            });
        }

        for(let spawn of this.manager.data.spawns) {
            this.generateRoad(spawn.pos, storagePos);
        }

        for(let cluster of this.manager.extensionsClusters) {
            this.generateRoad(storagePos, cluster.center, {
                targetRange: 0,
                withTarget: true,
            });
        }

        if(this.manager.room.controller.level > 5) {
            this.generateRoad(this.manager.mineral.pos, storagePos);
            if(this.manager.mineral.container) {
                this.generateRoad(this.manager.mineral.container.pos, storagePos);
            }
        }

        this.generateRoad(storagePos, this.manager.room.controller.pos, {
            targetRange: 3,
        });

        for(let handler of this.manager.remote.handlers) {
            if(!handler.data) {
                continue;
            }

            for(let source of handler.data.sources) {
                this.generateRoad(storagePos, source.pos, {
                    cutoffRange: -1,
                });
            }
        }
    }

    flagsToSites(room, flagCallback, constructionSiteType) {
        let placedAny = false;

        for(let flag of this.manager.flags.filter(flagCallback)) {
            if(OK === room.createConstructionSite(flag.pos, constructionSiteType)) {
                flag.remove();
                placedAny = true;
            }
        }

        return placedAny;
    }

    /**
     * @param {RoomPosition} from
     * @param {RoomPosition} to
     * @param [options]
     */
    generateRoad(from, to, options) {
        this.manager.processManager.addProcess(procBR.BuildRoad.factory(from, to, options));
    }

    toString() {
        return `[RoomArchitect for ${this.manager.room}]`;
    }
}

profiler.registerClass(RoomArchitect, RoomArchitect.name);

module.exports = {
    RoomArchitect
};