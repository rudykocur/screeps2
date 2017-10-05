let mind = require('mind.common');
let throttle = require('utils').throttle;

const STATE_REFILL = 'refill';
const STATE_BUILD = 'build';
const STATE_IDLE = 'idle';

class BuilderMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        let fsm = {
            [STATE_REFILL]: {
                onEnter: () => {},
                onTick: ()=> this.actions.refillFromStorage(STATE_BUILD, STATE_IDLE),
            },
            [STATE_BUILD]: {
                onEnter: this.pickBuildTarget.bind(this),
                onTick: this.doBuild.bind(this),
            },
            [STATE_IDLE]: {
                onTick: this.doCheckStatus.bind(this),
            }
        };

        this.setStateMachine(fsm, STATE_IDLE);
    }

    doCheckStatus() {
        if(_.sum(this.creep.carry) > 0) {
            if(this.room.constructionSites.length > 0) {
                this.enterState(STATE_BUILD);
                return;
            }

        }

        if(this.actions.isEnoughStoredEnergy() && _.sum(this.creep.carry) < this.creep.carryCapacity) {
            this.enterState(STATE_REFILL);
            return;
        }

        this.actions.gotoMeetingPoint();
    }

    pickBuildTarget() {
        let site = _.first(this.room.constructionSites);

        if(!site) {
            this.enterState(STATE_IDLE);
            return;
        }

        this.localState.buildSiteId = site.id;
    }

    doBuild() {
        let target = Game.getObjectById(this.localState.buildSiteId);

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