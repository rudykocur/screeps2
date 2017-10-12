let mind = require('mind.common');

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
            body = [MOVE, MOVE, WORK, WORK, WORK, WORK];
        }
        if(manager.room.energyCapacityAvailable > 750) {
            body = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK];
        }
        if(manager.room.energyCapacityAvailable > 1000) {
            body = [MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK];
        }

        if(mineralHarvester) {
            body = [WORK, WORK, MOVE, WORK, WORK, MOVE, WORK, WORK, MOVE, WORK, WORK, MOVE];

            if(manager.room.energyCapacityAvailable > 2000) {
                body = [WORK, WORK, MOVE, WORK, WORK, MOVE, WORK, WORK, MOVE, WORK, WORK, MOVE, WORK, WORK, MOVE,
                        WORK, WORK, MOVE, WORK, WORK, MOVE, WORK, WORK, MOVE];
            }
        }

        return {
            body: body,
            name: 'harvester',
            memo: {'mind': 'harvester', mineral: !!mineralHarvester}
        };
    }
}

module.exports = {
    HarvesterMind
};