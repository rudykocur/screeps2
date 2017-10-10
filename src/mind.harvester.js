let mind = require('mind.common');

class HarvesterMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);
    }

    update() {
        if(this.creep.spawning) {return}

        let job = this.getJob();

        if(job) {
            job.execute();
            return;
        }

        switch(this.state) {
            case 'seek':
                this.doSeekTarget();
                break;
            case 'harvest':
                this.doHarvest();
                break;
            default:
                this.enterState('seek');
        }
    }

    *findNewJob() {
        yield this.tryClaimJob(1, {
            type: 'harvest-source',
        })
    }

    getHarvestTarget() {
        return this.globalState['harvestId'];
    }

    doSeekTarget() {
        let target = this.getLocalTarget('targetId', () => {
            return this.roomMgr.getFreeEnergySource();
        });

        if(target.pos.isNearTo(this.creep)) {
            this.globalState['harvestId'] = target.id;
            this.enterState('harvest');
        }
        else {
            this.creep.moveTo(target);
        }
    }

    doHarvest() {
        let result = this.creep.harvest(Game.getObjectById(this.globalState['harvestId']));

        if(result != OK && result != ERR_NOT_ENOUGH_RESOURCES) {
            console.log('HARVEST FAIL', result);
        }
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