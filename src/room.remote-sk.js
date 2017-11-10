var _ = require("lodash");
const minds = require('mind');
const utils = require('utils');
const data = require('room.data');
const roomBase = require('room.base');

let threat = require('combat.threat');

const profiler = require('profiler');

class RemoteSKRoomHandler extends roomBase.RoomBase {
    /**
     * @param roomName
     * @param {RoomManager} parentManager
     */
    constructor(roomName, parentManager) {
        super(roomName);
        // this.timer.start();
        //
        this.parent = parentManager;
        this.jobManager = parentManager.jobManager;

        this.isRemote = true;
        this.isSKRoom = true;

        this.room = Game.rooms[this.roomName];

        if(!Memory.rooms[this.roomName]) {
            Memory.rooms[this.roomName] = {type: 'sk'};
        }

        this.enemies = [];

        if(this.room) {
            this.room.manager = this;

            this.data = new data.RoomData(this, this.room);
            // this.lairs = this.data.lairs;
            this.lairs = this.data.lairs.filter(lair => lair.pos.findInRange(this.data.sources, 5).length > 0);

            this.enemies = this.room.find(FIND_HOSTILE_CREEPS);

            this.extensionsClusters = [];
            this.towers = [];
            this.constructionSites = _.filter(Game.constructionSites, 'room', this.room);
        }

        this.threat = new threat.ThreatAssesment(this.enemies);
    }

    get memory() {
        return Memory.rooms[this.roomName];
    }

    /**
     *
     * @return {RoomPopulation}
     */
    get spawner() {
        return this.parent.spawner;
    }

    prioritySpawn() {
        if(this.shouldSpawnHunter()) {
            this.spawnMind(minds.available.skHunter);
        }
    }

    update() {
        if(this.room){
            if(this.getCreepCount(minds.available.skHunter) > 0) {
                if (this.getCreepCount(minds.available.harvester) < this.data.sources.length) {
                    this.spawnMind(minds.available.harvester, {skBody: true});
                }
                else if (this.constructionSites.length > 0 && this.getCreepCount(minds.available.builder) < 2) {
                    this.spawnMind(minds.available.builder);
                }
                else if (this.data.droppedEnergy.length > 0 && this.getCreepCount(minds.available.transfer) < 2) {
                    this.spawnMind(minds.available.transfer);
                }
                else if (_.sum(this.data.droppedEnergy, 'amount') > 4000 &&
                        this.getSpawnCooldown(minds.available.transfer) > 200 &&
                        this.getCreepCount(minds.available.transfer) <= 8) {
                        this.spawnMind(minds.available.transfer, {maxBody: true});
                    }
            }

            this.jobManager.run(this);
        }
    }

    spawnMind(mind, options) {
        let spawn = this.spawner.getFreeSpawn();

        if(spawn) {
            return this.spawner.spawn(this, mind.getSpawnParams(this.parent, options));
        }
    }

    getSpawnCooldown(mind) {
        return this.spawner.getSpawnCooldown(`${this.room.name}-${mind.name}`);
    }

    shouldSpawnHunter() {
        let total = this.getCreepCount(minds.available.skHunter);
        if(total === 0) {
            return true;
        }

        let hunters = this.getCreeps(minds.available.skHunter);

        if(total === 1 && hunters[0].creep.ticksToLive < 300) {
            return true;
        }

        return false;
    }

    toString() {
        return '[RemoteSK handler for ' + this.roomName + ']';
    }
}

profiler.registerClass(RemoteSKRoomHandler, RemoteSKRoomHandler.name);

module.exports = {
    RemoteSKRoomHandler
};