

class FiniteStateMachine {
    constructor(config, memory, initialState) {
        this.config = config;
        this.memory = memory;
        this.initialState = initialState;
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

    update() {
        if(!this.state) {
            this.enter(this.initialState);
        }

        if(this.config[this.state].onTick) {
            this.config[this.state].onTick(this.localState);
        }
    }

    enter(name, localState) {
        this.memory.state = name;
        this.memory.localState = (localState || {});

        if(this.config[name].onEnter) {
            this.config[name].onEnter(this.localState);
        }
    }
}

module.exports = {
    FiniteStateMachine
};