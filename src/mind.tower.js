let MindBase = require('mind.common').MindBase;
let throttle = require('utils').throttle;

// const STATE_REFILL = 'refill';
// const STATE_UPGRADE = 'upgrade';
// const STATE_IDLE = 'idle';

class TowerMind extends MindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);
    }

    update() {
        let enemy = _.first(this.room.room.find(FIND_HOSTILE_CREEPS));

        if(enemy) {
            this.creep.attack(enemy);
        }
    }
}

module.exports = {
    TowerMind
};