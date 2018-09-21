const bb = require('utils.bodybuilder');
let mind = require('mind.common');

const profiler = require('profiler');

class HarvesterMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);
    }

    update() {
        if(this.creep.spawning) {return}
        if(!this.creep.workRoom) {
            this.creep.mover.enterStationary();
            return
        }

        let job = this.getJob();

        if(job && (this.creep.workRoom.isSKRoom || this.creep.workRoom.threat.getCombatCreeps().length === 0)) {
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
            let claims = _.filter(this.creep.body, b => b.type === WORK).length;
            yield this.tryClaimJob(claims, {
                type: 'harvest-source',
                minAmount: claims,
            });

        }
    }

    /**
     * @param {RoomManager} manager
     * @param {{mineral, skBody}} options
     */
    static getSpawnParams(manager, options) {
        options = _.defaults(options || {}, {mineral: false, skBody: false});

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

        if(options.mineral) {
            body = bb.build([WORK, WORK, MOVE], manager.room.energyCapacityAvailable);
        }
        if(options.skBody) {
            body = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY];
        }

        return {
            body: body,
            name: 'harvester',
            memo: {
                'mind': 'harvester',
                mineral: options.mineral
            }
        };
    }
}

profiler.registerClass(HarvesterMind, HarvesterMind.name);

module.exports = {
    HarvesterMind
};