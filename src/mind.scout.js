let mind = require('mind.common');
let maps = require('maps');

const STATE_SCOUT = 'scout';
const STATE_IDLE = 'idle';

class ScoutMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        this.setStateMachine({
            [STATE_SCOUT]: {
                onTick: this.gotoRoom.bind(this)
            },
            [STATE_IDLE]: {
                onTick: () => {}
            }
        }, STATE_SCOUT);
    }

    gotoRoom() {
        let roomName = this.creep.memory.roomName;

        if(this.creep.room.name != roomName) {
            let room = maps.getRoomCache(roomName);
            this.creep.mover.moveTo(room.controller.pos);
        }
        else {
            if(!this.creep.pos.inRangeTo(this.creep.room.controller, 4)) {
                this.creep.mover.moveTo(this.creep.room.controller);
            }
            else {
                this.creep.mover.enterStationary();
                this.enterState(STATE_IDLE);
            }
        }
    }

    /**
     * @param {RoomManager} manager
     */
    static getSpawnParams(manager) {
        return {
            body: [MOVE],
            name: 'scout',
            memo: {'mind': 'scout'}
        };
    }
}

module.exports = {
    ScoutMind
};