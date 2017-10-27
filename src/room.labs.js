var _ = require('lodash');
const fsm = require('fsm');
const utils = require('utils');

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

        _.defaultsDeep(this.manager.room.memory, {labs: {fsm: {}, layout: {}}, });

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

    mustRegenerateLayout() {
        return this.memory.layout.labCount !== this.labs.length;
    }

    update() {
        if(this.labs.length < 3  || !this.terminal) {
            return;
        }

        if(this.mustRegenerateLayout() && this.fsm.state === STATE.IDLE) {
            this.regenerateLabLayout();
        }

        this.fsm.run();

        this.decorateLabs();
    }

    pickNextTarget() {
        if(this.mustRegenerateLayout()) {
            return;
        }

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
        let inputLabsIds = this.memory.layout.inputLabs;
        let outLabsIds = this.memory.layout.outputLabs;

        this.memory.inLabs = {
            in1: {
                id: inputLabsIds[0],
                resource: this.memory.currentReaction[0],
            },
            in2: {
                id: inputLabsIds[1],
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

        utils.every(100, () => {
            if((lab1.mineralAmount === 0 && this.terminal.get(input[0].resource) === 0) ||
                (lab2.mineralAmount === 0 && this.terminal.get(input[1].resource) === 0))
            {
                this.warn('Terminal has no required resources. Entering unload');
                this.fsm.enter(STATE.EMPTY);
            }
        })
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

        this.important('Finished current batch.');

        delete this.memory.finalTarget;
        delete this.memory.currentReaction;
        delete this.memory.inLabs;
        delete this.memory.outLabs;

        this.fsm.enter(STATE.IDLE);
    }

    getLabsToLoad() {
        if(this.fsm.state !== STATE.LOAD && this.fsm.state !== STATE.PROCESS) {
            return [];
        }

        return this.getInputLabs();
    }

    getLabsToUnload() {
        if(this.fsm.state !== STATE.EMPTY && this.fsm.state !== STATE.PROCESS) {
            return [];
        }

        let unloadThreshold = 350;
        if(this.fsm.state === STATE.EMPTY) {
            unloadThreshold = 0;
        }

        let result = [];

        for(let lab of this.getOutputLabs()) {
            if(lab.mineralAmount > unloadThreshold) {
                result.push(lab);
            }
        }

        if(this.fsm.state === STATE.EMPTY) {
            for(let input of this.getInputLabs()) {
                if(input.lab.mineralAmount > unloadThreshold) {
                    result.push(input.lab);
                }
            }
        }

        return result;
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

    regenerateLabLayout() {
        let lab1, lab2;

        for(let lab of this.labs) {
            let others = _.without(this.labs, lab);

            if(this.isReachable(lab, others)) {
                lab1 = lab;
                break;
            }
        }

        if(!lab1) {
            this.warn('Cannot find reachable first lab');
            return;
        }

        let remaining = _.without(this.labs, lab1);

        for(let lab of remaining) {
            let others = _.without(remaining, lab);

            if(this.isReachable(lab, others)) {
                lab2 = lab;
                break;
            }
        }

        if(!lab2) {
            this.warn('Cannot find reachable second lab');
            return;
        }

        lab1.room.visual.circle(lab1.pos, {radius: 1});
        lab2.room.visual.circle(lab2.pos, {radius: 1});

        this.memory.layout = {
            labCount: this.labs.length,
            inputLabs: [lab1.id, lab2.id],
            outputLabs: _.without(this.labs, lab1, lab2).map(lab => lab.id),
        };

        this.warn(`Regenerated lab layout for count: ${this.labs.length}`);
    }

    isReachable(centerLab, others) {
        for(let lab of others) {
            if(!lab.pos.inRangeTo(centerLab, 2)) {
                return false;
            }
        }

        return true;
    }

    decorateLabs() {
        if(this.mustRegenerateLayout()) {
            for(let lab of this.labs) {
                lab.room.visual.circle(lab.pos, {
                    fill: 'transparent',
                    stroke: 'yellow',
                    strokeWidth: 0.2,
                    radius: 0.6
                })
            }
        }
        else {
            for(let labId of this.memory.layout.inputLabs) {
                let lab = Game.getObjectById(labId);
                lab.room.visual.circle(lab.pos, {
                    fill: 'transparent',
                    stroke: 'pink',
                    strokeWidth: 0.2,
                    radius: 0.6
                })
            }
        }
    }

    addDiagnosticMessages(messages) {
        if(this.labs.length < 3) {
            return;
        }

        messages.push(`Labs state: ${this.fsm.state}`);
        if(this.fsm.state !== STATE.IDLE) {
            messages.push(`Labs target: ${this.memory.finalTarget.resource}, reaction: ${this.memory.currentReaction}`);
        }
    }

    toString() {
        return `[LabManager for ${this.manager.roomName}]`;
    }
}

module.exports = {
    LabManager
};