let mind = require('mind.common');

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
            let direction = this.creep.room.findExitTo(roomName);
            let exit = this.creep.pos.findClosestByRange(direction);
            this.creep.moveTo(exit);
        }
        else {
            if(!this.creep.pos.inRangeTo(this.creep.room.controller, 5)) {
                this.creep.moveTo(this.creep.room.controller);
            }
            else {
                this.enterState(STATE_IDLE);
            }
        }
    }

    /**
     * @param {RoomManager} manager
     * @param roomName
     */
    static getSpawnParams(manager, roomName) {
        return {
            body: [MOVE],
            name: 'scout',
            memo: {'mind': 'scout', roomName: roomName}
        };
    }
}

module.exports = {
    ScoutMind
};