const fsmModule = require('fsm');

class JobHandlerBase {
    constructor(creep, jobData) {
        this.creep = creep;
        this.room =  this.creep.room;
        this.roomMgr = this.room.manager;
        this.data = jobData;
        this.fsm = null;

        if(!this.creep.memory.jobStateData) {
            this.creep.memory.jobStateData = {}
        }

        this.creep.memory.jobStateData.fsm = this.creep.memory.jobStateData.fsm || {};
    }

    configureFSM(initialState, config) {
        this.fsm = new fsmModule.FiniteStateMachine(config, this.jobData.fsm, initialState)
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
    }

    execute() {
        if(this.fsm) {
            this.fsm.update();
        }
    }
}

class JobDTO {
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