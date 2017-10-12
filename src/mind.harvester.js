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
        yield this.tryClaimJob(1, {
            type: 'harvest-source',
        });

        yield this.tryClaimJob(1, {
            type: 'harvest-mineral',
        });
    }

    /**
     * @param {RoomManager} manager
     * @param roomName
     */
    static getSpawnParams(manager, roomName) {
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

        return {
            body: body,
            name: 'harvester',
            memo: {'mind': 'harvester'}
        };
    }
}

module.exports = {
    HarvesterMind
};