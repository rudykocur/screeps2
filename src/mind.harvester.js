let MindBase = require('mind.common').MindBase;

class HarvesterMind extends MindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);
    }

    update() {
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

    getHarvestTarget() {
        return this.globalState['harvestId'];
    }

    doSeekTarget() {
        let target = this.getLocalTarget('targetId', () => {
            return this.room.getFreeEnergySource();
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

        if(result != OK) {
            console.log('HARVEST FAIL', result);
        }
    }
}

module.exports = {
    HarvesterMind
};