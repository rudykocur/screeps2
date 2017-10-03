let MindBase = require('mind.common').MindBase;

const STATE_REFILL = 'refill';
const STATE_BUILD = 'build';

class BuilderMind extends MindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);
    }

    update() {
        switch(this.state) {
            case STATE_REFILL:
                this.doSeekTarget();
                break;
            case STATE_BUILD:
                this.doBuild();
                break;
            default:
                this.enterState(STATE_REFILL);
        }
    }

    doSeekTarget() {
        if(this.creep.room.energyAvailable < this.creep.room.energyCapacityAvailable) {
            return;
        }

        let target = this.getLocalTarget('targetId', () => {
            let resources = this.creep.room.find(FIND_DROPPED_RESOURCES);
            return _.first(_.sortByOrder(resources, ['amount'], ['desc']));
        });

        if(!target) {
            return;
        }

        if(target.pos.isNearTo(this.creep)) {
            this.creep.pickup(target);
            this.enterState(STATE_BUILD);
        }
        else {
            this.creep.moveTo(target);
        }
    }

    doBuild() {
        let target = this.getLocalTarget('targetId', () => {
            return _.first(this.room.constructionSites);
        });

        if(!target) {
            this.enterState(STATE_REFILL);
            return;
        }

        if(target.pos.inRangeTo(this.creep, 3)) {
            this.creep.build(target);

            if(_.sum(this.creep.carry) < 1) {
                this.enterState(STATE_REFILL);
            }
        }
        else {
            this.creep.moveTo(target);
        }
    }
}

module.exports = {
    BuilderMind
};