var _ = require('lodash');
const fsmModule = require('fsm');
const utils = require('utils');
const maps = require('maps');
const actions = require('common-actions');

const profiler = require('profiler');

class JobHandlerBase extends utils.Loggable {
    /**
     * @param {Creep} creep
     * @param jobData
     */
    constructor(creep, jobData) {
        super();

        this.creep = creep;
        this.room =  this.creep.room;
        /**
         * @type {RoomManager}
         */
        this.roomMgr = this.creep.workRoom;
        this.workRoom = this.creep.workRoom;
        this.data = jobData;

        /**
         * @type {FiniteStateMachine}
         */
        this.fsm = null;

        if(!this.creep.memory.jobStateData) {
            this.creep.memory.jobStateData = {}
        }

        this.creep.memory.jobStateData.fsm = this.creep.memory.jobStateData.fsm || {};

        /**
         * @type {CreepCommonActions}
         */
        this.actions = new actions.CreepCommonActions(this.creep, this.workRoom);
    }

    configureFSM(initialState, config) {
        this.fsm = new fsmModule.FiniteStateMachine(config, this.jobData.fsm, initialState);

        this.fsm.onStateChange = () => this.creep.mover.enterStationary();
    }

    get state() {
        return this.creep.memory.jobState;
    }

    set state(value) {
        return this.creep.memory.jobState = value;
    }

    get jobData() {
        return this.creep.memory.jobStateData;
    }

    unclaim() {
        delete this.data.claims[this.creep.name];
    }

    completeJob() {
        delete this.creep.memory.jobId;
        delete this.data.claims[this.creep.name];
        delete this.data.takenBy[this.creep.name];
        delete this.creep.memory.jobStateData;
        delete this.creep.memory.jobState;

        this.creep.mover.enterStationary();
    }

    execute() {
        if(this.fsm) {
            this.fsm.run();
        }
    }

    toString() {
        return `[${this.constructor.name} for ${this.creep}]`;
    }
}

class JobDTO {
    /**
     * @param id
     * @param type
     * @param mind
     * @param [available]
     */
    constructor(id, type, mind, available) {
        this.id = id;
        this.type = type;
        this.mind = mind.name;

        this.available = available || 1;
        this.claims = {};
        this.takenBy = {};
        this.deleted = false;
    }

    merge(data) {
    }
}

module.exports = {
    JobDTO, JobHandlerBase
};