const utils = require('utils');
const actions = require('common-actions');
const fsm = require('fsm');

const profiler = require('profiler');

/**
 * @property {Room} room
 */
class CreepMindBase extends utils.Executable {
    /**
     *
     * @param {Creep} creep
     * @param {RoomManager|RemoteRoomHandler} roomManager
     */
    constructor(creep, roomManager) {
        super();

        this.roomMgr = roomManager;

        /**
         * @type {RoomManager}
         */
        this.homeRoomMgr = null;

        if(this.roomMgr.isRemote) {
            this.homeRoomMgr = this.roomMgr.parent;
        }
        else {
            this.homeRoomMgr = this.roomMgr;
        }

        this.room = this.roomMgr.room;

        /**
         * @type {Creep}
         */
        this.creep = creep;
        creep.mind = this;

        if(!this.creep.memory.mindStateData) {
            this.creep.memory.mindStateData = {}
        }

        /**
         * @type {FiniteStateMachine}
         */
        this._fsm = null;

        /**
         * @type {CreepCommonActions}
         */
        this.actions = new actions.CreepCommonActions(this.creep, roomManager);
    }

    setStateMachine(fsmConfig, initalState) {
        this._fsm = new fsm.FiniteStateMachine(fsmConfig, this.creep.memory.mindStateData, initalState);

        this._fsm.onStateChange = () => this.creep.mover.enterStationary();
    }

    update() {
        if(this.creep.spawning) {
            return;
        }

        if(!this._fsm) {
            return
        }

        this._fsm.update();
    }

    enterState(name, localState) {
        if(!this._fsm) {
            return;
        }

        this._fsm.enter(name, localState);
    }

    /**
     * @return {RoomManager}
     */
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
     * @param {Number} amount
     * @param {JobBoardSearchQuery} query
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
     * @param {JobBoardSearchQuery} options
     */
    findJob(options) {
        if(!options.rooms) {
            options.room = this.room;
        }

        options.mind = this;

        return _.first(this.roomMgr.jobManager.find(options));
    }

    toString() {
        return `[${this.constructor.name} for ${this.creep}]`;
    }
}

profiler.registerClass(CreepMindBase, CreepMindBase.name);


module.exports = {
    CreepMindBase
};