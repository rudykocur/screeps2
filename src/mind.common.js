

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

        this.actions = new MindCommonActions(this, this.creep, this.room);
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

class MindCommonActions {

    constructor(mind, creep, room) {
        this.mind = mind;
        this.creep = creep;
        this.room = room;
    }

    isEnoughStoredEnergy() {
        return this.room.storage.getStoredEnergy() > this.creep.carryCapacity/2;
    }

    refillFromStorage(nextState, idleState) {
        if(!this.isEnoughStoredEnergy()) {
            this.mind.enterState(idleState);
            return;
        }

        if(this.room.storage.isNear(this.creep)) {
            this.room.storage.withdraw(this.creep);
            this.mind.enterState(nextState);
        }
        else {
            this.creep.moveTo(this.room.storage.target);
        }
    }

    gotoMeetingPoint() {
        if(!this.room.meetingPoint) {
            return;
        }

        if(!this.room.meetingPoint.pos.inRangeTo(this.creep, 3)) {
            this.creep.moveTo(this.room.meetingPoint);
        }
    }
}

module.exports = {
    MindBase
};