var _ = require("lodash");
const maps = require('maps');
const base = require('room.base');
const minds = require('mind');

const profiler = require('profiler');

class RoomSettlement extends base.RoomBase {
    constructor(roomName, claimFlag, regularRooms) {
        super(roomName);

        this.flag = claimFlag;
        this.managers = regularRooms;
    }

    update() {
        let claimers = this.getCreepCount(minds.available.claimer);

        this.pushWanderer();

        if(!this.room && claimers === 0) {
            this.spawnAndGo();
        }
        else {
            if(!this.room.controller.my) {
                if(this.getCreepCount(minds.available.claimer) === 0) {
                    let name = this.spawn(minds.available.claimer, {claim: true}, true);
                    if(name) {
                        this.important(name, 'en route...');
                    }
                }
            }
            else {
                this.room.createConstructionSite(this.flag.pos, STRUCTURE_SPAWN);

                if(this.getCreepCount(minds.available.settler) < 4) {
                    this.spawn(minds.available.settler);
                }

                if(this.room.find(FIND_STRUCTURES).filter(s => s.structureType == STRUCTURE_SPAWN).length > 0) {
                    this.flag.remove();
                    this.important(`New colony has been created at room ${this.roomName}`);
                    Game.notify(`New colony has been created at room ${this.roomName}`);
                }
            }
        }
    }

    getSpawner(nearest) {
        let managers = _.sortBy(this.managers, mgr => Game.map.getRoomLinearDistance(mgr.roomName, this.roomName));
        managers = managers.filter(m => m.room.controller.level > 3);

        for(let mgr of managers) {
            let spawn = mgr.spawner.getFreeSpawn();

            if (spawn) {
                return mgr;
            }

            if(nearest) {
                break;
            }
        }
    }

    spawn(mind, options, nearest) {
        let manager = this.getSpawner(nearest);

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
    }

    pushWanderer() {
        let creepName = 'wanderer_' + this.roomName;
        let wanderer = Game.creeps[creepName];
        if(wanderer && !wanderer.pos.inRangeTo(this.flag.pos, 5)) {
            wanderer.mover.moveByPath(this.flag.pos, () => {
                return maps.getMultiRoomPath(wanderer.pos, this.flag.pos);
            });
        }

    }

    toString() {
        return `[RoomSettlement for ${this.roomName}]`;
    }

}

profiler.registerClass(RoomSettlement, RoomSettlement.name);

module.exports = {
    RoomSettlement
};