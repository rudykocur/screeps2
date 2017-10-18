var _ = require("lodash");
const maps = require('maps');
const base = require('room.base');
const minds = require('mind');

class RoomSettlement extends base.RoomBase {
    constructor(roomName, claimFlag, regularRooms) {
        super(roomName);

        this.flag = claimFlag;
        this.managers = regularRooms;
    }

    update() {

        if(!this.room) {
            this.spawnAndGo();
        }
        else {
            if(!this.room.controller.my) {
                if(this.getCreepCount(minds.available.claimer) === 0) {
                    this.spawn(minds.available.claimer, {claim: true});
                }
            }
            else {
                this.room.createConstructionSite(this.flag.pos, STRUCTURE_SPAWN);

                if(this.getCreepCount(minds.available.settler) < 2) {
                    this.spawn(minds.available.settler);
                }

                if(this.room.find(FIND_STRUCTURES).filter(s => s.structureType == STRUCTURE_SPAWN).length > 0) {
                    this.flag.remove();
                    Game.notify(`New colony has been created at room ${this.roomName}`);
                }
            }
        }
    }

    getSpawner() {
        for(let mgr of this.managers) {
            let spawn = mgr.spawner.getFreeSpawn();

            if(spawn) {
                return mgr;
            }
        }
    }

    spawn(mind, options) {
        let manager = this.getSpawner();

        if(manager) {
            return manager.spawner.spawn(this, mind.getSpawnParams(manager, options));

        }
    }

    spawnAndGo() {
        let creepName = 'wanderer_' + this.roomName;
        let wanderer = Game.creeps[creepName];
        if(!wanderer) {
            for(let spawn of _.values(Game.spawns)) {
                if(spawn.spawnCreep([MOVE], creepName) === OK) {
                    console.log(this, 'spawned', creepName);
                    break;
                }
            }
        }
        else {
            let claimPath = maps.getMultiRoomPath(wanderer.pos, this.flag.pos);
            let x = wanderer.moveByPath(claimPath);
        }
    }

    toString() {
        return `[RoomSettlement for ${this.roomName}]`;
    }

}

module.exports = {
    RoomSettlement
};