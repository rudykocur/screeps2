var _ = require('lodash');
const fsmModule = require('fsm');
const utils = require('utils');

class JobHandlerBase extends utils.Loggable {
    constructor(creep, jobData) {
        super();

        this.creep = creep;
        this.room =  this.creep.room;
        this.roomMgr = this.creep.workRoom;
        this.workRoom = this.creep.workRoom;
        this.data = jobData;
        this.fsm = null;

        if(!this.creep.memory.jobStateData) {
            this.creep.memory.jobStateData = {}
        }

        this.creep.memory.jobStateData.fsm = this.creep.memory.jobStateData.fsm || {};

        this.actions = new JobCommonActions(this, this.creep, this.workRoom, this.fsm);
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
            this.fsm.run();
        }
    }

    toString() {
        return `[${this.constructor.name} for ${this.creep}]`;
    }
}

class JobCommonActions {
    constructor(handler, creep, workRoom, fsm) {
        this.hander = handler;
        this.creep = creep;
        this.workRoom = workRoom;
        this.fsm = fsm;
    }

    /**
     * @param [options] Options
     * @param [options.onDone] callback invoked after transfer
     * @param [options.onTick] callback invoked in each tick
     * @param [options.storage] Storage where unload to
     */
    unloadAllResources(options) {
        options = _.defaults(options || {}, {
            onDone: () => {},
            onTick: () => {},
            storage: this.workRoom.storage
        });

        options.onTick();

        if(!options.storage.canDeposit(this.creep)) {
            this.creep.mover.moveTo(options.storage.target);
        }
        else {
            if(this.creep.carryTotal > 0) {
                options.storage.deposit(this.creep);
            }
            else {
                options.onDone();
            }
        }
    }

    /**
     * @param resource
     * @param [options] Options
     * @param [options.onDone] callback invoked after transfer
     */
    withdrawFromStorage(resource, options) {
        options = _.defaults(options, {
            onDone: () => {},
        });

        let storage = this.workRoom.storage;

        if(!storage.isNear(this.creep)) {
            this.creep.mover.moveTo(storage.target);
        }
        else {
            storage.withdraw(this.creep, resource);
            options.onDone();
        }
    }

    /**
     *
     * @param target
     * @param resource
     * @param {{onDone,getAmount}} options
     */
    withdrawFrom(target, resource, options) {
        options = _.defaults(options, {
            onDone: () => {},
            getAmount: () => undefined
        });

        if(_.isString(target)) {
            target = Game.getObjectById(target);
        }

        if(!target) {
            options.onDone();
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.mover.moveTo(target);
        }
        else {
            this.creep.withdraw(target, resource, options.getAmount());

            options.onDone();
        }
    }

    /**
     * @param target
     * @param resource
     * @param [options] Options
     * @param [options.onDone] callback invoked after transfer
     */
    transferInto(target, resource, options) {
        options = _.defaults(options, {onDone: () => {}});

        if(_.isString(target)) {
            target = Game.getObjectById(target);
        }

        if(!target) {
            options.onDone();
            return;
        }

        if(!this.creep.pos.isNearTo(target)) {
            this.creep.mover.moveTo(target);
        }
        else {
            this.creep.transfer(target, resource);
            options.onDone();
        }
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