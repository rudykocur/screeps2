/**
 * @property {Room} room
 */
class CreepMindBase {
    /**
     *
     * @param creep
     * @param {RoomManager} roomManager
     */
    constructor(creep, roomManager) {
        this.roomMgr = roomManager;
        this.room = this.roomMgr.room;
        this.creep = creep;
        this.localState = this.creep.memory.localState;
        this.globalState = this.creep.memory.globalState = (this.creep.memory.globalState || {});
        this._fsm = null;

        this.actions = new MindCommonActions(this, this.creep, this.workRoom);
    }

    setStateMachine(fsm, initalState) {
        this._fsm = fsm;

        if(!this.state){
            this.enterState(initalState);
        }
    }

    update() {
        if(this.creep.spawning) {
            return;
        }

        if(!this._fsm) {
            return
        }

        if(this._fsm[this.state].onTick) {
            this._fsm[this.state].onTick();
        }
    }

    get state() {
        return this.creep.memory.state;
    }
    set state(value) {
        this.creep.memory.state = value;
    }

    enterState(name, localState) {
        this.creep.memory.state = name;
        this.creep.memory.localState = this.localState = (localState || {});

        if(!this._fsm) {
            return;
        }

        if(this._fsm[name].onEnter) {
            this._fsm[name].onEnter();
        }
    }

    getLocalTarget(targetKey, callback) {
        if(!this.localState[targetKey]) {
            let target = callback();
            if(target) {
                this.localState[targetKey] = target.id;
            }
        }

        let target = this.localState[targetKey];

        if(target) {
            let result = Game.getObjectById(this.localState[targetKey]);
            if(!result) {
                delete this.localState[targetKey];
            }
            else {
                return result;
            }
        }
    }

    get workRoom() {
        let workRoom = Game.rooms[this.creep.memory.roomName];
        if(workRoom) {
            return workRoom.manager;
        }
    }

    /**
     * To be overriden. Use `yield this.tryClaimJob` to return viable job.
     *
     * @override
     */
    *findNewJob() {}

    /**
     * Returns existing job handler or find new job for given mind.
     */
    getJob() {
        if(this.creep.memory.jobId) {
            let job = this.roomMgr.jobManager.getJobHandler(this.creep);
            if(job) {
                return job;
            }
        }

        for(let jobId of this.findNewJob()) {
            if(jobId) {
                this.creep.memory.jobId = jobId;
                return this.roomMgr.jobManager.getJobHandler(this.creep);
            }
        }
    }

    /**
     * Run given job search query and claim given amount from this job
     */
    tryClaimJob(amount, query) {
        let job = this.findJob(query);

        if(job) {
            if(this.roomMgr.jobManager.claim(this.creep, job, amount)) {
                return job.id;
            }
        }
    }

    /**
     * Do job search and return first found job
     */
    findJob(options) {
        options.room = this.room;
        options.mind = this;

        return _.first(this.roomMgr.jobManager.find(options));
    }
}

class MindCommonActions {

    constructor(mind, creep, roomManager) {
        this.mind = mind;
        this.creep = creep;
        this.workRoom = roomManager;
    }

    isEnoughStoredEnergy(minThreshold) {
        minThreshold = minThreshold || 0;
        return (this.workRoom.storage.getStoredEnergy() - minThreshold) > this.creep.carryCapacity/2;
    }

    refillFromStorage(nextState, idleState, minThreshold) {
        if(!this.isEnoughStoredEnergy(minThreshold)) {
            this.mind.enterState(idleState);
            return;
        }

        if(this.workRoom.storage.isNear(this.creep)) {
            this.workRoom.storage.withdraw(this.creep);
            this.mind.enterState(nextState);
        }
        else {
            this.creep.moveTo(this.workRoom.storage.target);
        }
    }

    gotoMeetingPoint() {
        if(!this.mind.workRoom.meetingPoint) {
            return;
        }

        if(!this.mind.workRoom.meetingPoint.pos.inRangeTo(this.creep, 3)) {
            this.creep.moveTo(this.mind.workRoom.meetingPoint);
        }
    }
}

module.exports = {
    CreepMindBase
};