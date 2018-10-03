var _ = require("lodash");
const minds = require('mind');
const utils = require('utils');

const profiler = require('profiler');

class RoomPopulation extends utils.Executable {
    /**
     *
     * @param {RoomManager} manager
     * @param {Array<ExtensionCluster>}extensionsClusters
     * @param {Array<StructureSpawn>} spawns
     */
    constructor(manager, extensionsClusters, spawns) {
        super();

        this.manager = manager;
        this.room = this.manager.room;

        this.freeSpawns = spawns.filter(spawn => !spawn.spawning);

        this.energyStructures = [];
        let clusters = _.sortByOrder(extensionsClusters, ['needsEnergy'], ['desc']);
        clusters.forEach(cluster => {
            this.energyStructures.push.apply(this.energyStructures, cluster.extensions);
        });

        this.energyStructures.push.apply(this.energyStructures, spawns);

        this.notEnoughEnergy = false;
        this.spawningBlocked = false;
    }

    update() {
        let spawn = this.getFreeSpawn();

        if(spawn) {
            if(this.needSettler()) {
                this.spawnSettler(spawn);
            }
            else if (this.manager.getCreepCount(minds.available.harvester, {mineral: false}) < 1) {
                this.spawnHarvester(spawn, true);
            }
            else if(this.needTransfer()) {
                this.spawnTransfer(spawn, true);
            }
            else if(this.manager.getCreepCount(minds.available.harvester, {mineral: false}) < 2) {
                this.spawnHarvester(spawn, true);
            }
            else if(this.needHauler()) {
                this.spawnHauler(spawn, true);
            }
            else if(this.manager.getCreepCount(minds.available.upgrader) < 1) {
                this.spawnUpgrader(spawn)
            }
            else if(this.needHarvester()) {
                this.spawnHarvester(spawn, true);
            }
            else if(this.needMineralHarvester()) {
                this.spawnMineralHarvester(spawn);
            }
            else if(this.manager.constructionSites.length > 0 && this.manager.getCreepCount(minds.available.builder) < 1) {
                this.spawnBuilder(spawn);
            }
            else if(this.manager.getAvgEnergyToPickup() > 1300 && this.getSpawnCooldown('transfer', this.room) > 200) {
                this.spawnTransfer(spawn);
            }
            else if(this.needUpgrader()) {
                this.spawnUpgrader(spawn)
            }
            else if(this.needBuilders()) {
                this.spawnBuilder(spawn);
            }
            else if(this.needReinforcer()) {
                this.spawnReinforcer(spawn);
            }
            else if(this.needRemoteTransferers()) {
                this.spawnRemoteTransferer(spawn);
            }
        }

        if(this.freeSpawns.length > 0 && !spawn.spawning && spawn.blocking) {
            let s = this.freeSpawns.pop();
            s.room.visual.circle(s.pos, {fill: "red", opacity: 0.7, radius: 0.7})
        }

    }

    getFreeSpawn() {
        return _.first(this.freeSpawns);
    }

    /**
     * @param {RoomManager|RemoteRoomHandler|RoomSiege} targetRoom
     * @param {{memo,body,name}} options
     */
    spawn(targetRoom, options) {

        let spawn = this.getFreeSpawn();

        if(!spawn) {
            return;
        }

        return this._doSpawn(targetRoom, spawn, options.body, options.name, options.memo, false);
    }

    doSpawn(spawn, body, name, memo, blocking) {
        return this._doSpawn(this.manager, spawn, body, name, memo, blocking);
    }

    /**
     *
     * @param {RoomManager|RemoteRoomHandler}targetRoom
     * @param {StructureSpawn} spawn
     * @param {Array} body
     * @param {String} name
     * @param {Object} memo
     * @param blocking
     * @private
     */
    _doSpawn(targetRoom, spawn, body, name, memo, blocking) {
        if(this.spawningBlocked) {
            return;
        }

        memo.roomName = targetRoom.roomName;

        let spawnTest = spawn.spawnCreep(body, 'TEST CREEP NAME', {
            memory: memo,
            energyStructures: this.energyStructures,
            dryRun: true,
        });

        let result = spawnTest;

        if(spawnTest === OK) {
            name = this.manager.getCreepName(name);

            result = spawn.spawnCreep(body, name, {
                memory: memo,
                energyStructures: this.energyStructures,
            });
        }

        spawn.blocking = !!blocking;
        this.spawningBlocked = !!blocking;

        if(result !== OK) {
            if(result === ERR_NOT_ENOUGH_ENERGY) {
                this.notEnoughEnergy = true;

                this.room.visual.circle(spawn.pos, {
                    fill: "transparent",
                    stroke: "red",
                    strokeWidth: 0.2,
                    radius: 0.8,
                    lineStyle: (this.manager === targetRoom ? undefined : 'dashed'),
                });
                return;
            }

            this.err('Failed to spawn', name, '::', body, '::',result);
        }
        else {
            this.freeSpawns.splice(this.freeSpawns.indexOf(spawn), 1);

            this.room.memory.lastSpawnTick[targetRoom.roomName + '-' + memo.mind] = Game.time;
            this.printSummarisedSpawn(targetRoom.getRoomLink(), name, body);

            return name;
        }
    }

    printSummarisedSpawn(targetRoom, name, body) {
        let bodyCounts = _.countBy(body);
        let bodyStr = _.map(bodyCounts, (count, key) => `${key}=${count}`).join(',');
        let cost = _.sum(body, b => BODYPART_COST[b]);

        this.info('Creep', name, 'created. Target room:', targetRoom, 'cost:', cost, 'parts:', bodyStr);
    }

    getSpawnCooldown(mindType, room) {
        let spawnKey = mindType;
        if(room) {
            spawnKey = room.name+'-'+mindType;
        }

        return (Game.time - this.room.memory.lastSpawnTick[spawnKey]) || 9999;
    }

    needBuilders() {
        if(this.manager.constructionSites.length === 0) {
            return false;
        }

        let totalBuilders = this.manager.getCreepCount(minds.available.builder);
        let pointsLeft = _.sum(this.manager.constructionSites, site => site.progressTotal - site.progress);

        let spawnOpts = minds.available.builder.getSpawnParams(this.manager);
        let builderLifetimePower = spawnOpts.body.filter(part => part == WORK).length * BUILD_POWER * CREEP_LIFE_TIME / 2;

        let buildersNeeded = pointsLeft / builderLifetimePower;

        return totalBuilders < Math.min(buildersNeeded, 3);
    }

    needHarvester() {
        let options = minds.available.harvester.getSpawnParams(this.manager);
        let workParts = _.filter(options.body, b => b === WORK).length;

        let neededWorkers = _.sum(
            this.manager.data.sources
                .filter(s => s.pos.findInRange(this.manager.data.lairs, 7).length === 0)
                .map(/**Source*/s => Math.floor(s.energyCapacity / 300 / 2 / workParts)));

        return this.manager.getCreepCount(minds.available.harvester) < neededWorkers;
    }

    needMineralHarvester() {
        if(!this.manager.data.extractor) {
            return false;
        }

        if(this.manager.data.mineral.mineralAmount < 1) {
            return false;
        }

        return this.manager.getCreepCount(minds.available.harvester, {mineral: true}) < 1;
    }

    needUpgrader() {
        if(this.manager.isSupporting) {
            return false;
        }

        if(this.manager.room.controller.level === 8) {
            return false;
        }

        if(this.manager.room.controller.level === 7) {
            if(this.manager.storage.getStoredEnergy() < 150000) {
                if (this.manager.getCreepCount(minds.available.upgrader) >= 2) {
                    return false;
                }
            }
        }

        if(this.getSpawnCooldown('upgrader', this.room) < 200) {
            return false;
        }

        if(this.manager.room.storage) {
            return this.manager.storage.getStoredEnergy() > 40000;
        }
        else {
            return this.manager.storage.getStoredEnergy() > 1000;
        }
    }

    needSettler() {
        if(this.manager.room.controller.level > 2) {
            return false;
        }

        let requiredSettlers = 4;

        if(this.manager.room.controller.level === 2) {
            requiredSettlers = 2;
        }

        return this.manager.getCreepCount(minds.available.settler) < requiredSettlers;
    }

    needTransfer() {
        /**
         * @type {Array<CreepMindBase>}
         */
        let creeps = this.manager.getMinds(minds.available.transfer, {remoteHelper: false, hauler: false});

        let aliveMinds = creeps.filter(mind => mind.creep.ticksToLive > 400);

        if(aliveMinds.length === 0) {
            return true;
        }

        if(creeps.length < 2) {
            return true;
        }
    }

    needHauler() {
        if(this.manager.terminal && this.manager.data.labs >= 3) {
            return true;
        }

        let haulers = this.manager.getMinds(minds.available.transfer).filter(mind => mind.creep.memory.hauler).length;

        return haulers < 1;
    }

    needReinforcer() {
        let reinforcers = this.manager.getMinds(minds.available.builder).filter(mind => mind.creep.memory.reinforcer).length;

        if(reinforcers > 0) {
            return false;
        }

        if(this.manager.storage.getStoredEnergy() < 20000) {
            return false;
        }

        return this.manager.data.ramparts.length > 0 || this.manager.data.walls.length > 0;
    }

    needRemoteTransferers() {
        let count = this.manager.getCreepCount(minds.available.transfer, {remoteHelper: true});

        let maxCount = (this.manager.room.controller.level > 6) ? 6 : 3;

        if(count > maxCount) {
            return false;
        }

        return this.manager.getExpectedEnergyInRemoteMines() > 5000;
    }

    spawnHarvester(spawn, blocking) {
        let options = minds.available.harvester.getSpawnParams(this.manager, false);
        if(this.manager.creeps.length < 1) {
            options.body = [MOVE, WORK, WORK];
        }
        this.doSpawn(spawn, options.body, options.name, options.memo, blocking);
    }

    spawnMineralHarvester(spawn) {
        let options = minds.available.harvester.getSpawnParams(this.manager, {mineral: true});
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }

    spawnTransfer(spawn, blocking) {
        let options = minds.available.transfer.getSpawnParams(this.manager);
        if(this.manager.creeps.length < 2) {
            options.body = [MOVE, MOVE, CARRY, CARRY];
            options.memo.emergency = true;
        }
        this.doSpawn(spawn, options.body, options.name, options.memo, blocking);
    }

    spawnHauler(spawn, blocking) {
        let options = minds.available.transfer.getSpawnParams(this.manager, {hauler: true});
        this.doSpawn(spawn, options.body, options.name, options.memo, blocking);
    }

    spawnUpgrader(spawn) {
        let options = minds.available.upgrader.getSpawnParams(this.manager);
        this.doSpawn(spawn, options.body, options.name, options.memo);

    }

    spawnBuilder(spawn) {
        let options = minds.available.builder.getSpawnParams(this.manager);
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }

    spawnSettler(spawn) {
        let options = minds.available.settler.getSpawnParams(this.manager);
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }

    spawnReinforcer(spawn) {
        let options = minds.available.builder.getSpawnParams(this.manager, {reinforcer: true});
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }

    spawnRemoteTransferer(spawn) {
        let options = minds.available.transfer.getSpawnParams(this.manager, {remoteHelper: true});
        this.doSpawn(spawn, options.body, options.name+'Remote', options.memo);
    }

    toString() {
        return `[Spawner ${this.manager.getRoomLink()}]`;
    }
}

profiler.registerClass(RoomPopulation, RoomPopulation.name);

module.exports = {
    RoomPopulation
};