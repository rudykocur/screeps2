const bb = require('utils.bodybuilder');
let mind = require('mind.common');

const profiler = require('profiler');

class HarvesterMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);
    }

    update() {
        if(this.creep.spawning) {return}
        if(!this.creep.workRoom) {return}

        let job = this.getJob();

        if(job && !this.creep.workRoom.danger) {
            job.execute();
            return;
        }

        this.actions.gotoMeetingPoint();

    }

    *findNewJob() {
        if(this.creep.memory.mineral) {
            yield this.tryClaimJob(1, {
                type: 'harvest-mineral',
            });
        }
        else {
            yield this.tryClaimJob(1, {
                type: 'harvest-source',
            });

        }
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager, mineralHarvester) {
        let body = [MOVE, WORK, WORK];
        if(manager.room.energyCapacityAvailable > 500) {
            body = [WORK, WORK, WORK, WORK, MOVE, MOVE];
        }
        if(manager.room.energyCapacityAvailable > 750) {
            body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];
        }
        if(manager.room.energyCapacityAvailable > 1000) {
            body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        }

        if(mineralHarvester) {
            body = bb.build([WORK, WORK, MOVE], manager.room.energyCapacityAvailable);
        }

        return {
            body: body,
            name: 'harvester',
            memo: {'mind': 'harvester', mineral: !!mineralHarvester}
        };
    }
}

profiler.registerClass(HarvesterMind, HarvesterMind.name);

module.exports = {
    HarvesterMind
};