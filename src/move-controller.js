var _ = require('lodash');

class CreepMoveController {
    constructor(creep) {
        this.creep = creep;
    }

    get memory() {
        return this.creep.memory;
    }

    moveTo(target, options) {
        let result = this.creep.moveTo(target, options);
        if(result == OK) {
            this.exitStationary();
        }

        return result;
    }

    serializeStep(pos) {
        return pos.x+','+pos.y+','+pos.roomName;
    }

    unserializePath(path) {
        let result = [];
        let steps = path.split(';');
        return steps.map(step => {
            let parts = step.split(',');
            return new RoomPosition(parts[0], parts[1], parts[2]);
        })
    }

    moveByPath(pathCallback) {
        if(!this.memory._moverPath) {
            this.memory._moverPath = {
                path: pathCallback().map(this.serializeStep).join(';'),
                currentPos: this.creep.pos,
                blockCounter: 0,
            };
        }

        let path = this.unserializePath(this.memory._moverPath.path);

        let result = this.creep.moveByPath(path);

        if(this.memory._moverPath.blockCounter > 4) {
            new RoomVisual(this.creep.pos.roomName).circle(this.creep.pos, {fill:'red', radius: 0.7});
            delete this.memory._moverPath;
            this.enterStationary();
            return;
        }

        this._updateCurrentStep(this.memory._moverPath);

        if(result === ERR_NOT_FOUND || result ===  ERR_INVALID_ARGS) {
            delete this.memory._moverPath;
        }
    }

    _updateCurrentStep(state) {
        let step = new RoomPosition(state.currentPos.x, state.currentPos.y, state.currentPos.roomName);

        if(step.isEqualTo(this.creep.pos)) {
            state.blockCounter += 1;
        }
        else {
            this.exitStationary();
            state.blockCounter = 0;
        }

        state.currentPos = this.creep.pos;
    }

    enterStationary() {
        this.memory.isStationary = true;
        delete this.memory._moverPath;
    }

    exitStationary() {
        this.memory.isStationary = false;
    }
}

module.exports = {
    CreepMoveController
};