var _ = require("lodash");
const minds = require('mind');
const utils = require('utils');

class RoomPopulationMind extends utils.Executable {
    /**
     *
     * @param {RoomManager} manager
     */
    constructor(manager) {
        super();

        this.manager = manager;
        this.room = this.manager.room;

        this.freeSpawns = this.manager.spawns.filter(spawn => !spawn.spawning);

        this.energyStructures = [];
        let clusters = _.sortByOrder(this.manager.extensionsClusters, ['needsEnergy'], ['desc']);
        clusters.forEach(cluster => {
            this.energyStructures.push.apply(this.energyStructures, cluster.extensions);
        });

        this.energyStructures.push.apply(this.energyStructures, this.manager.spawns);
    }

    update() {
        let spawn = this.getFreeSpawn();

        if(spawn) {
            if(this.needSettler()) {
                this.spawnSettler(spawn);
            }
            else if (this.manager.getCreepCount(minds.available.harvester) < 1) {
                this.spawnHarvester(spawn, true);
            }
            else if(this.manager.getCreepCount(minds.available.transfer) < 2) {
                this.spawnTransfer(spawn, true);
            }
            else if(this.manager.getCreepCount(minds.available.harvester) < 2) {
                this.spawnHarvester(spawn, true);
            }
            else if(this.manager.getCreepCount(minds.available.upgrader) < 1) {
                this.spawnUpgrader(spawn)
            }
            else if(this.needMineralHarvester()) {
                this.spawnMineralHarvester(spawn);
            }
            else if(this.manager.constructionSites.length > 0 && this.manager.getCreepCount(minds.available.builder) < 1) {
                this.spawnBuilder(spawn);
            }
            else if(this.manager.getAvgEnergyToPickup() > 1300 && this.getSpawnCooldown('transfer') > 200) {
                this.spawnTransfer(spawn);
            }
            else if(this.needUpgrader()) {
                this.spawnUpgrader(spawn)
            }
            else if(this.needBuilders()) {
                this.spawnBuilder(spawn);
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
     * @param options
     */
    spawn(targetRoom, options) {
        let spawn = this.getFreeSpawn();

        if(!spawn) {
            return;
        }

        options.memo.roomName = targetRoom.roomName;

        let name = this.manager.getCreepName(options.name);

        let result = spawn.spawnCreep(options.body, name, {
            memory: options.memo,
            energyStructures: this.energyStructures,
        });

        if(result != OK) {
            if(result == ERR_NOT_ENOUGH_ENERGY) {
                this.room.visual.circle(spawn.pos, {
                    fill: "transparent",
                    stroke: "red",
                    strokeWidth: 0.2,
                    radius: 0.8,
                    lineStyle: 'dashed',
                });
                return;
            }
            console.log('Failed to spawn', name, '::', options.bod, '::',result);
        }
        else {
            this.freeSpawns.splice(this.freeSpawns.indexOf(spawn), 1);

            this.room.memory.lastSpawnTick[targetRoom.roomName + '-' + options.memo.mind] = Game.time;

            this.printSummarisedSpawn(targetRoom.roomName, name, options.body);

            return name;
        }
    }

    doSpawn(spawn, body, name, memo, blocking) {
        name = this.manager.getCreepName(name);

        memo.roomName = spawn.room.name;

        let result = spawn.spawnCreep(body, name, {
            memory: memo,
            energyStructures: this.energyStructures,
        });

        spawn.blocking = !!blocking;

        if(result != OK) {
            if(result == ERR_NOT_ENOUGH_ENERGY) {
                this.room.visual.circle(spawn.pos, {fill: "transparent", stroke: "red", strokeWidth: 0.2, radius: 0.8});
                return;
            }
            console.log('Failed to spawn', name, '::', body, '::',result);
        }
        else {
            this.freeSpawns.splice(this.freeSpawns.indexOf(spawn), 1);

            this.room.memory.lastSpawnTick[memo.mind] = Game.time;
            this.printSummarisedSpawn(memo.roomName, name, body);
        }
    }

    printSummarisedSpawn(targetRoom, name, body) {
        let bodyCounts = _.countBy(body);
        let bodyStr = _.map(bodyCounts, (count, key) => `${key}=${count}`).join(',');
        let cost = _.sum(body, b => BODYPART_COST[b]);

        this.info('Creep', name, 'created. Target room:', targetRoom, 'cost:', cost, 'parts:', bodyStr);
    }

    getSpawnCooldown(mindType) {
        return (Game.time - this.room.memory.lastSpawnTick[mindType]) || 9999;
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

    needMineralHarvester() {
        if(!this.manager.extractor) {
            return false;
        }

        if(this.manager.mineralAmount < 1) {
            return false;
        }

        return this.manager.getMinds(minds.available.harvester).filter(mind => mind.creep.memory.mineral).length < 1;
    }

    needUpgrader() {
        if(this.getSpawnCooldown('upgrader') < 200) {
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

    spawnHarvester(spawn, blocking) {
        let options = minds.available.harvester.getSpawnParams(this.manager, false);
        if(this.manager.creeps.length < 1) {
            options.body = [MOVE, WORK, WORK];
        }
        this.doSpawn(spawn, options.body, options.name, options.memo, blocking);
    }

    spawnMineralHarvester(spawn) {
        let options = minds.available.harvester.getSpawnParams(this.manager, true);
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }

    spawnTransfer(spawn, blocking) {
        let options = minds.available.transfer.getSpawnParams(this.manager);
        if(this.manager.creeps.length < 2) {
            options.body = [MOVE, MOVE, CARRY, CARRY];
        }
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

    toString() {
        return `[Spawner ${this.manager.roomName}]`;
    }
}

module.exports = {
    RoomPopulationMind
};