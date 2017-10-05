const _ = require("lodash");
const minds = require('mind');

class RoomManager {
    constructor(room) {
        this.room = room;

        this.creeps = _.filter(Game.creeps, "room", this.room);
        this.minds = this.creeps.map((c) => minds.getMind(c, this));

        this.mindsByType = _.groupBy(this.minds, 'constructor.name');

        this.storage = new StorageWrapper(this, Game.flags.STORAGE);
        this.meetingPoint = Game.flags.IDLE;

        this.constructionSites = _.filter(Game.constructionSites, 'room', this.room);
        this.droppedEnergy = _.filter(this.room.find(FIND_DROPPED_RESOURCES), (res) => {
            if(res.resourceType != RESOURCE_ENERGY) {
                return false;
            }

            return !res.pos.isEqualTo(this.storage.target.pos);
        });

        this.enemies = this.room.find(FIND_HOSTILE_CREEPS);

        let towers = _.filter(Game.structures, (struct) => {
            if(struct.room != this.room) {
                return false;
            }

            return struct.structureType == STRUCTURE_TOWER;
        });

        this.towers = [];

        this.towers = towers.map(tower => {
            let mind = new minds.available.tower(tower, this);
            this.minds.push(mind);
            return mind;
        });
    }

    getCreepName(name) {
        return 'creep_'+(this.room.memory.counter++) + '_' + name;
    }

    getCreepCount(type) {
        if(!this.mindsByType[type.name]) {
            return 0;
        }

        return this.mindsByType[type.name].length;
    }

    getMinds(type) {
        return this.mindsByType[type.name];
    }

    getFreeEnergySource() {
        let usedSources = this.getMinds(minds.available.harvester).map(mind => {
            return mind.getHarvestTarget();
        });

        let sources = this.room.find(FIND_SOURCES, {
            filter: (src) => {
                return usedSources.indexOf(src.id) < 0;
            }
        });

        return _.first(sources);
    }

    getDroppedEnergy(sourcePos, minAmount) {
        minAmount = minAmount || 0;

        return sourcePos.findClosestByPath(this.droppedEnergy, {
            filter: (res) => res.amount > minAmount
        });
    }

    update() {
        if(this.towers.length < 1 && this.enemies.length > 0 && !this.room.controller.safeMode) {
            console.log('Activating SAFE MODE!!!!');
            Game.notify('ATTACK. SAFE MODE ACTIVATED');
            this.room.controller.activateSafeMode();
        }

        let spawn = this.getFreeSpawn();

        if(spawn) {
            if (this.getCreepCount(minds.available.harvester) < 1) {
                this.spawnHarvester(spawn);
            }
            else if(this.getCreepCount(minds.available.transfer) < 2) {
                this.spawnTransfer(spawn);
            }
            else if(this.getCreepCount(minds.available.harvester) < 2) {
                this.spawnHarvester(spawn);
            }
            else if(this.getCreepCount(minds.available.transfer) < 3) {
                this.spawnTransfer(spawn);
            }
            else if(this.getCreepCount(minds.available.upgrader) < 3) {
                this.spawnUpgrader(spawn)
            }
            else if(this.constructionSites.length > 0 && this.getCreepCount(minds.available.builder) < 2) {
                let body = [MOVE, MOVE, CARRY, CARRY, WORK];
                let memo = {'mind': 'builder'};

                this.doSpawn(spawn, body, 'builder', memo);
            }
            else if(_.sum(this.droppedEnergy, 'amount') > 1300 && this.getSpawnCooldown() > 200) {
                this.spawnTransfer(spawn);
            }
            else if(this.storage.getStoredEnergy() > 2000 && this.getSpawnCooldown() > 400) {
                this.spawnUpgrader(spawn)
            }
        }
    }

    spawnHarvester(spawn) {
        let body = [MOVE, WORK, WORK];
        if(this.room.energyCapacityAvailable > 500) {
            body = [MOVE, MOVE, WORK, WORK, WORK, WORK];
        }
        if(this.room.energyCapacityAvailable > 750) {
            body = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK];
        }
        this.doSpawn(spawn, body, 'harvester', {'mind': 'harvester'})
    }
    spawnTransfer(spawn) {
        let body = [MOVE, MOVE, CARRY, CARRY];
        if(this.room.energyCapacityAvailable > 500) {
            body = [MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY];
        }

        if(this.room.energyCapacityAvailable > 700) {
            body = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
        }
        this.doSpawn(spawn, body, 'transfer', {'mind': 'transfer'});

    }
    spawnUpgrader(spawn) {
        let body = [MOVE, MOVE, CARRY, CARRY, WORK];
        if(this.room.energyCapacityAvailable > 600) {
            body = [MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, WORK, WORK, WORK];
        }
        this.doSpawn(spawn, body, 'upgrader', {'mind': 'upgrader'})
    }

    doSpawn(spawn, body,name, memo) {
        name = this.getCreepName(name);

        let result = spawn.spawnCreep(body, name, {memory: memo});

        if(result != OK) {
            if(result == ERR_NOT_ENOUGH_ENERGY) {
                this.room.visual.circle(spawn.pos, {fill: "transparent", stroke: "red", strokeWidth: 0.2, radius: 0.8});
                return;
            }
            console.log('Failed to spawn', name, '::', body, '::',result);
        }
        else {
            this.room.memory.lastSpawnTick = Game.time;
            console.log('Spawned new creep', name, 'with body:', body);
        }
    }

    getSpawnCooldown() {
        if(this.room.memory.lastSpawnTick) {
            return Game.time - this.room.memory.lastSpawnTick;
        }

        return 9999;
    }

    getFreeSpawn() {
        let spawns = _.filter(_.filter(Game.structures, "room", this.room), (s) => {return s instanceof StructureSpawn});

        // console.log('spawns', spawns);

        return _.first(_.filter(spawns, "spawning", null));
    }
}

class StorageWrapper {
    constructor(room, target) {
        this.room = room;
        this.target = target;
        this.isFlag = target instanceof Flag;
        this.resource = null;
        if(this.isFlag) {
            this.resource =  _.first(this.target.pos.lookFor(LOOK_RESOURCES));
        }
    }

    getStoredEnergy() {
        if(this.isFlag) {
            if(!this.resource) {
                return 0;
            }
            return this.resource.amount;
        }
    }

    isNear(creep) {
        if(this.isFlag) {
            return this.target.pos.isNearTo(creep.pos);
        }
    }

    canDeposit(creep) {
        if(this.isFlag) {
            return this.target.pos.isEqualTo(creep.pos);
        }
    }

    deposit(fromCreep) {
        if(this.isFlag) {
            fromCreep.drop(RESOURCE_ENERGY);
        }
    }

    withdraw(toCreep) {
        if(this.isFlag) {
            toCreep.pickup(this.resource);
        }
    }
}

module.exports = {
    RoomManager: RoomManager
};