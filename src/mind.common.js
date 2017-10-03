

class MindBase {
    /**
     *
     * @param creep
     * @param {RoomManager} roomManager
     */
    constructor(creep, roomManager) {
        this.room = roomManager;
        this.creep = creep;
        this.localState = this.creep.memory.localState;
        this.globalState = this.creep.memory.globalState = (this.creep.memory.globalState || {});
        this._fsm = null;
    }

    setStateMachine(fsm, initalState) {
        this._fsm = fsm;

        if(!this.state){
            this.enterState(initalState);
        }
    }

    update() {
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
}

module.exports = {
    MindBase
};