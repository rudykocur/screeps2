const utils = require('utils');

class FiniteStateMachine extends utils.Executable {
    constructor(config, memory, initialState) {
        super();

        this.config = config;
        this.memory = memory;
        this.initialState = initialState;

        this.onStateChange = null;
    }

    get state() {
        return this.memory.state;
    }
    set state(value) {
        this.memory.state = value;
    }

    get localState() {
        return this.memory.localState;
    }

    update(...args) {
        if(!this.state) {
            this.enter(this.initialState);
        }

        if(this.config[this.state].onTick) {
            this.config[this.state].onTick(this.localState, ...args);
        }
    }

    enter(name, localState) {
        this.memory.state = name;
        this.memory.localState = (localState || {});

        if(this.config[name].onEnter) {
            this.config[name].onEnter(this.localState);
        }

        if(this.onStateChange) {
            this.onStateChange();
        }
    }
}

module.exports = {
    FiniteStateMachine
};