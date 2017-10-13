var _ = require('lodash');
const fsm = require('fsm');

const STATE = {
    IDLE: 'idle',
    EMPTY: 'empty',
    LOAD: 'load',
    RUN: 'run',
};

class LabManager {
    constructor(manager) {
        this.manager = manager;

        this.manager.room.memory.labs = this.manager.room.memory.labs || {};
        this.memory.fsm = this.memory.fsm || {};

        this.fsm = new fsm.FiniteStateMachine({
            [STATE.IDLE]: {},
            [STATE.EMPTY]: {},
            [STATE.LOAD]: {},
            [STATE.RUN]: {},
        }, this.memory.fsm, STATE.IDLE);
    }

    get memory() {
        return this.manager.room.memory.labs;
    }

    get finalTarget() {
        return RESOURCE_LEMERGIUM_ALKALIDE;
    }

    get neededAmount() {
        return 1000;
    }

    update() {

    }
}

module.exports = {
    LabManager
};