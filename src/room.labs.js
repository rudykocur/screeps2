var _ = require('lodash');
const fsm = require('fsm');
const utils = require('utils');

const profiler = require('profiler');

const STATE = {
    IDLE: 'idle',
    EMPTY: 'empty',
    LOAD: 'load',
    PROCESS: 'process',
    LOAD_BOOST: 'loadBoost',
    EMPTY_BOOST: 'emptyBoost',
};

class LabManager extends utils.Executable {
    constructor(manager, labs, terminal) {
        super();

        this.manager = manager;
        this.labs = _.sortBy(labs, 'id');
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
            [STATE.LOAD_BOOST]: {
                onEnter: () => {this.important('Entered boost load state.')},
                 onTick: () => {},
            },
            [STATE.EMPTY_BOOST]: {
                 onTick: this.checkBoostsUnloaded.bind(this),
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

    update(exchange) {
        if(this.labs.length < 3  || !this.terminal) {
            return;
        }

        if(this.mustRegenerateLayout() && this.fsm.state === STATE.IDLE) {
            this.regenerateLabLayout();
        }

        this.fsm.run(exchange);

        this.decorateLabs();
    }

    loadBoosts(resources) {
        this.memory.boostsToLoad = resources;

        if(this.fsm.state === STATE.PROCESS || this.fsm.state.LOAD) {
            this.warn('Interrupting cooking. Time to prepare boosts:', resources);

            this.fsm.enter(STATE.EMPTY);
        }
    }

    unloadBoosts() {
        this.fsm.enter(STATE.EMPTY_BOOST);
    }

    checkBoostsUnloaded() {
        for(let lab of this.labs) {
            if(lab.mineralAmount > 0) {
                return;
            }
        }

        this.important('Going back to regular work.');

        delete this.memory.boostsToLoad;

        this.fsm.enter(STATE.IDLE);
    }

    getActiveBoosts() {
        if(!this.memory.boostsToLoad) {
            return [];
        }

        return this.memory.boostsToLoad;
    }

    areBoostsReady() {
        if(!this.memory.boostsToLoad) {
            return false;
        }

        for(let i = 0; i < this.memory.boostsToLoad.length; i++) {
            let resource = this.memory.boostsToLoad[i];
            let lab = this.labs[i];

            if(lab.mineralAmount  === 0) {
                return false;
            }

            if(lab.energy < 800) {
                return false;
            }
        }

        return true;
    }

    pickNextTarget(state, exchange) {
        if(this.mustRegenerateLayout()) {
            return;
        }

        if(this.memory.boostsToLoad) {
            this.fsm.enter(STATE.LOAD_BOOST);
            return;
        }

        let target = this.pickNextFinalTarget(exchange);

        if(!target) {
            return;
        }

        let currentReaction = utils.getNextReaction(target.resource, target.amount, this.terminal.store);

        this.memory.finalTarget = target;
        this.memory.currentReaction = currentReaction;
        this.memory.currentReactionProgress = 0;

        this.memory.currentReactionAmount = this.calculateCurrentReactionBatchSize();

        this.important(`Set new target: ${target.resource} with reaction ${currentReaction}. ` +
            `To produce: ${this.memory.currentReactionAmount}`);

        this.fsm.enter(STATE.LOAD);
    }

    calculateCurrentReactionBatchSize() {
        let target = this.memory.finalTarget;
        let currentReaction = this.memory.currentReaction;
        let currentProduct = REACTIONS[currentReaction[0]][currentReaction[1]];
        let needsOfFinalTarget = target.amount - this.terminal.get(target.resource);

        if(target.resource === currentProduct) {
            return Math.min(needsOfFinalTarget, LAB_MINERAL_CAPACITY);
        }

        let haveCurrentReaction = this.terminal.get(currentProduct);

        return Math.min(needsOfFinalTarget - haveCurrentReaction, LAB_MINERAL_CAPACITY);
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

    getCurrentTarget() {
        let reaction = this.memory.currentReaction;
        return REACTIONS[reaction[0]][reaction[1]];
    }

    runReactions() {
        let input = this.getInputLabs();
        let lab1 = input[0].lab;
        let lab2 = input[1].lab;

        let producedAmount = 0;

        for(let lab of this.getOutputLabs()) {
            if(lab.runReaction(lab1, lab2) === OK) {
                producedAmount += LAB_REACTION_AMOUNT;
            }
        }

        this.memory.currentReactionProgress = (this.memory.currentReactionProgress || 0)  + producedAmount;

        if(this.memory.currentReactionProgress >= this.memory.currentReactionAmount) {
            this.fsm.enter(STATE.EMPTY);
        }

        if((lab1.mineralAmount === 0 && this.terminal.get(input[0].resource) === 0) ||
            (lab2.mineralAmount === 0 && this.terminal.get(input[1].resource) === 0))
        {
            this.important('Depleted available resources. Entering unload.');
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

        this.important('Finished current batch.');

        delete this.memory.finalTarget;
        delete this.memory.currentReaction;
        delete this.memory.inLabs;
        delete this.memory.outLabs;

        this.fsm.enter(STATE.IDLE);
    }

    getLabsToLoad() {
        if(this.fsm.state === STATE.LOAD_BOOST) {
            let result = [];

            for(let i = 0; i < this.memory.boostsToLoad.length; i++) {
                let resource = this.memory.boostsToLoad[i];
                let lab = this.labs[i];

                if(lab.mineralAmount < 2000) {
                    result.push({
                        lab, resource
                    });
                }

                if(lab.energy < 1000) {
                    result.push({
                        lab,
                        resource: RESOURCE_ENERGY
                    });
                }

            }

            return result;
        }

        if(this.fsm.state !== STATE.LOAD && this.fsm.state !== STATE.PROCESS) {
            return [];
        }

        return this.getInputLabs();
    }

    getLabsToUnload() {
        if(this.fsm.state !== STATE.EMPTY && this.fsm.state !== STATE.PROCESS &&
            this.fsm.state !== STATE.EMPTY_BOOST)
        {
            return [];
        }

        let unloadThreshold = 800;
        if(this.fsm.state === STATE.EMPTY || this.fsm.state === STATE.EMPTY_BOOST) {
            unloadThreshold = 0;
        }

        let result = [];

        if(this.fsm.state === STATE.EMPTY_BOOST) {
            for(let lab of this.labs) {
                if(lab.mineralAmount > unloadThreshold) {
                    result.push(lab);
                }
            }

            return result;
        }

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

    pickNextFinalTarget(exchange) {
        let targets = this.getTargets();

        for(let target of targets) {
            let amount = exchange.getTotal(target.resource);
            if(amount < target.amount) {
                return target;
            }
        }
    }

    getTargets() {
        if(this.labs.length === 3) {
            return [
                {resource: RESOURCE_HYDROXIDE, amount: 6000},
                {resource: RESOURCE_GHODIUM, amount: 6000},
            ];
        }

        return _.shuffle([
            {resource: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, amount: 6000},
            {resource: RESOURCE_CATALYZED_GHODIUM_ALKALIDE, amount: 6000},
            {resource: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, amount: 6000},
            {resource: RESOURCE_CATALYZED_UTRIUM_ACID, amount: 6000},
            {resource: RESOURCE_CATALYZED_KEANIUM_ALKALIDE, amount: 6000},
        ]).concat([
            {resource: RESOURCE_HYDROXIDE, amount: 6000},
            {resource: RESOURCE_GHODIUM, amount: 6000},
        ]);
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
            if(this.fsm.state === STATE.LOAD || this.fsm.state === STATE.PROCESS) {
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

            if(this.fsm.state === STATE.LOAD_BOOST) {
                for(let i = 0; i < this.memory.boostsToLoad.length; i++) {
                    let resource = this.memory.boostsToLoad[i];
                    let lab = this.labs[i];

                    if(lab.mineralAmount  === 0 || lab.energy < 800) {
                        lab.room.visual.circle(lab.pos, {
                            fill: 'transparent',
                            stroke: 'red',
                            strokeWidth: 0.2,
                            radius: 0.6,
                            opacity: 0.7,
                        });
                        lab.room.visual.text(resource, lab.pos, {font: 0.5});
                    }
                    else {
                        lab.room.visual.circle(lab.pos, {
                            fill: 'transparent',
                            stroke: 'green',
                            strokeWidth: 0.2,
                            radius: 0.6,
                            opacity: 0.7,
                        });
                    }
                }
            }
        }
    }

    addDiagnosticMessages(messages) {
        if(this.labs.length < 3) {
            return;
        }

        messages.push(`Labs state: ${this.fsm.state}`);
        if(this.fsm.state !== STATE.IDLE && this.memory.finalTarget) {
            let progress = this.memory.currentReactionProgress;
            let reactionTotal = this.memory.currentReactionAmount;

            messages.push(`Labs target: ${this.memory.finalTarget.resource} x ${this.memory.finalTarget.amount}`);
            messages.push(`Labs reaction: ${this.memory.currentReaction} ${progress}/${reactionTotal}`);
        }
    }

    toString() {
        return `[LabManager for ${this.manager.roomName}]`;
    }
}

profiler.registerClass(LabManager, LabManager.name);

module.exports = {
    LabManager
};