var _ = require('lodash');
const fsm = require('fsm');
const utils = require('utils');
const flags = require('utils.flags');

const STATE = {
    IDLE: 'idle',
    EMPTY: 'empty',
    LOAD: 'load',
    PROCESS: 'process',
};

class LabManager extends utils.Executable {
    constructor(manager, labs, terminal) {
        super();

        this.manager = manager;
        this.labs = labs;
        this.terminal = terminal;

        _.defaultsDeep(this.manager.room.memory, {labs: {fsm: {}}, });

        this.fsm = new fsm.FiniteStateMachine({
            [STATE.IDLE]: {
                onTick: this.pickNextTarget.bind(this),
            },
            [STATE.LOAD]: {
                onEnter: this.prepareLabsForLoad.bind(this),
                onTick: this.checkLabsLoaded.bind(this),
            },
            [STATE.PROCESS]: {
                onTick: utils.throttle(10, this.runReactions.bind(this))
            },
            [STATE.EMPTY]: {
                 onTick: this.checkLabsEmpty.bind(this),
            },
        }, this.memory.fsm, STATE.IDLE);
    }

    get memory() {
        return this.manager.room.memory.labs;
    }

    getInputLabs() {
        if(!this.memory.inLabs) {
            return;
        }

        return [
            {
                lab: Game.getObjectById(this.memory.inLabs.in1.id),
                resource: this.memory.inLabs.in1.resource
            },
            {
                lab: Game.getObjectById(this.memory.inLabs.in2.id),
                resource: this.memory.inLabs.in2.resource
            }
        ];
    }

    getOutputLabs() {
        return this.memory.outLabs.map(Game.getObjectById);
    }

    update() {
        if(this.labs.length < 3 || !this.terminal) {
            return;
        }

        this.fsm.run();
    }

    pickNextTarget() {
        let target = this.pickNextFinalTarget();

        if(!target) {
            return;
        }

        let currentReaction = utils.getNextReaction(target.resource, target.amount, this.terminal.store);

        this.memory.finalTarget = target;
        this.memory.currentReaction = currentReaction;

        this.important('Set new target:', target.resource, 'with reaction:', currentReaction);

        this.fsm.enter(STATE.LOAD);
    }

    prepareLabsForLoad() {
        let inputLabs = [];
        let outLabsIds = [];
        for(let lab of this.labs) {
            let isInput = _.first(lab.pos.lookFor(LOOK_FLAGS).filter(flags.isInputLab));

            if(isInput) {
                inputLabs.push(lab);
            }
            else {
                outLabsIds.push(lab.id);
            }
        }

        if(inputLabs.length !== 2) {
            this.warn('Invalid input labs:', inputLabs);
            this.fsm.enter(STATE.IDLE);
            return;
        }

        let labs = _.sortBy(inputLabs, 'id');

        this.memory.inLabs = {
            in1: {
                id: labs[0].id,
                resource: this.memory.currentReaction[0],
            },
            in2: {
                id: labs[1].id,
                resource: this.memory.currentReaction[1],
            },
        };

        this.memory.outLabs = outLabsIds;
    }

    checkLabsLoaded() {
        for(let input of this.getInputLabs()) {
            if(input.lab.mineralAmount === 0) {
                return;
            }
        }

        this.fsm.enter(STATE.PROCESS);
    }

    runReactions() {
        let input = this.getInputLabs();
        let lab1 = input[0].lab;
        let lab2 = input[1].lab;

        for(let lab of this.getOutputLabs()) {
            lab.runReaction(lab1, lab2);
        }

        let currentTarget = REACTIONS[input[0].resource][input[1].resource];
        let currentAmount = this.terminal.get(currentTarget);

        if(currentAmount > this.memory.finalTarget.amount) {
            this.fsm.enter(STATE.EMPTY);
        }
    }

    checkLabsEmpty() {
        for(let input of this.getInputLabs()) {
            if(input.lab.mineralAmount > 0) {
                return;
            }
        }

        for(let lab of this.getOutputLabs()) {
            if(lab.mineralAmount > 0) {
                return;
            }
        }

        delete this.memory.finalTarget;
        delete this.memory.currentReaction;
        delete this.memory.inLabs;
        delete this.memory.outLabs;

        this.fsm.enter(STATE.IDLE);
    }

    pickNextFinalTarget() {
        let targets = this.getTargets();

        for(let target of targets) {
            let amount = this.terminal.get(target.resource);
            if(amount < target.amount) {
                return target;
            }
        }
    }

    getTargets() {
        if(this.manager.room.terminal.get(RESOURCE_CATALYST) > 0) {
            return [
                {resource: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, amount: 3000},
                {resource: RESOURCE_CATALYZED_GHODIUM_ALKALIDE, amount: 3000},
                {resource: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, amount: 3000},
                {resource: RESOURCE_CATALYZED_UTRIUM_ACID, amount: 3000},
            ];
        }

        return [
                {resource: RESOURCE_LEMERGIUM_ALKALIDE, amount: 3000},
                {resource: RESOURCE_GHODIUM_ALKALIDE, amount: 3000},
                {resource: RESOURCE_ZYNTHIUM_ALKALIDE, amount: 3000},
                {resource: RESOURCE_CATALYZED_UTRIUM_ACID, amount: 3000},
            ];
    }

    toString() {
        return `[LabManager for ${this.manager.roomName}]`;
    }
}

module.exports = {
    LabManager
};