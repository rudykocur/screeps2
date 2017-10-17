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
            if (this.manager.getCreepCount(minds.available.harvester) < 1) {
                this.spawnHarvester(spawn);
            }
            else if(this.manager.getCreepCount(minds.available.transfer) < 2) {
                this.spawnTransfer(spawn);
            }
            else if(this.manager.getCreepCount(minds.available.harvester) < 2) {
                this.spawnHarvester(spawn);
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
            else if(_.sum(this.manager.droppedEnergy, 'amount') > 1300 && this.getSpawnCooldown('transfer') > 200) {
                this.spawnTransfer(spawn);
            }
            else if(this.needUpgrader()) {
                this.spawnUpgrader(spawn)
            }
            else if(this.manager.constructionSites.length > 0 && this.needBuilders()) {
                this.spawnBuilder(spawn);
            }
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

            console.log(`Spawned for room ${targetRoom.roomName} new creep ${name} with body: ${options.body}`);

            return name;
        }
    }

    doSpawn(spawn, body, name, memo) {
        name = this.manager.getCreepName(name);

        memo.roomName = spawn.room.name;

        let result = spawn.spawnCreep(body, name, {
            memory: memo,
            energyStructures: this.energyStructures,
        });

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
            console.log(`Spawned for room ${spawn.room.name} new creep ${name} with body: ${body}`);
        }
    }

    getSpawnCooldown(mindType) {
        return (Game.time - this.room.memory.lastSpawnTick[mindType]) || 9999;
    }

    needBuilders() {
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
            return this.manager.storage.getStoredEnergy() > 1700;
        }
    }

    spawnHarvester(spawn) {
        let options = minds.available.harvester.getSpawnParams(this.manager, false);
        if(this.manager.creeps.length < 1) {
            options.body = [MOVE, WORK, WORK];
        }
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }

    spawnMineralHarvester(spawn) {
        let options = minds.available.harvester.getSpawnParams(this.manager, true);
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }

    spawnTransfer(spawn) {
        let options = minds.available.transfer.getSpawnParams(this.manager);
        if(this.manager.creeps.length < 2) {
            options.body = [MOVE, MOVE, CARRY, CARRY];
        }
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }
    spawnUpgrader(spawn) {
        let options = minds.available.upgrader.getSpawnParams(this.manager);
        this.doSpawn(spawn, options.body, options.name, options.memo);

    }

    spawnBuilder(spawn) {
        let options = minds.available.builder.getSpawnParams(this.manager);
        this.doSpawn(spawn, options.body, options.name, options.memo);
    }
}

module.exports = {
    RoomPopulationMind
};