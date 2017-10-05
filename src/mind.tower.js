
// const STATE_REFILL = 'refill';
// const STATE_UPGRADE = 'upgrade';
// const STATE_IDLE = 'idle';

class TowerMind {
    constructor(tower, roomManager) {
        //super(creep, roomManager);
        this.tower = tower;
        this.roomMgr = roomManager;
    }

    get id() {
        return this.tower.id;
    }

    update() {
        let enemy = _.first(this.roomMgr.room.find(FIND_HOSTILE_CREEPS));

        if(enemy) {
            this.tower.attack(enemy);
        }
    }

    needsEnergy() {
        return this.tower.energy < 500;
    }
}

module.exports = {
    TowerMind
};