let mind = require('mind.common');

const STATE = {
    IDLE: 'idle',
    RESERVE: 'reserve'
};

class ClaimerMind extends mind.CreepMindBase {
    constructor(creep, roomManager) {
        super(creep, roomManager);

        this.setStateMachine({
            [STATE.IDLE]: {
                onTick: () => {}
            },
            [STATE.RESERVE]: {
                onTick: this.reserveController.bind(this)
            }
        }, STATE.RESERVE);
    }

    reserveController() {
        if(this.workRoom) {
            let target = this.workRoom.room.controller;

            if(!this.creep.pos.isNearTo(target)) {
                this.creep.moveTo(target);
                return;
            }

            if(target.reservation && target.reservation.username != 'rudykocur') {
                this.creep.attackController(target);
            }
            else {
                this.creep.reserveController(target)
            }
        }
    }

    /**
     * @param {RoomManager} manager
     * @param roomName
     */
    static getSpawnParams(manager, roomName) {
        return {
            body: [CLAIM, MOVE, CLAIM, MOVE],
            name: 'claimer',
            memo: {'mind': 'claimer', roomName: roomName}
        };
    }
}

module.exports = {
    ClaimerMind
};