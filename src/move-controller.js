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

    moveByPath(pathCallback) {
        if(!this.memory._moverPath) {
            console.log(this.creep, 'regenerating cached path');
            this.memory._moverPath = {
                path: pathCallback(),
                currentPos: this.creep.pos,
                blockCounter: 0,
            };
        }

        let path = [];

        for(let step of this.memory._moverPath.path) {
            // step.__proto__ = RoomPosition.prototype;
            path.push(new RoomPosition(step.x, step.y, step.roomName));
        }

        let result = this.creep.moveByPath(path);

        if(this.memory._moverPath.blockCounter > 4) {
            console.log('OMG CREEP', this.creep, 'IS STUCK');
            delete this.memory._moverPath;
            return;
        }

        this._updateCurrentStep(this.memory._moverPath);

        if(result === ERR_NOT_FOUND || result ===  ERR_INVALID_ARGS) {
            console.log(this.creep, ' - mover: ', result);
            delete this.memory._moverPath;
        }
    }

    _updateCurrentStep(state) {
        let step = new RoomPosition(state.currentPos.x, state.currentPos.y, state.currentPos.roomName);

        if(step.isEqualTo(this.creep.pos)) {
            state.blockCounter += 1;
        }
        else {
            state.blockCounter = 0;
        }

        state.currentPos = this.creep.pos;
    }

    enterStationary() {
        this.memory.isStationary = true;
    }

    exitStationary() {
        this.memory.isStationary = false;
    }
}

module.exports = {
    CreepMoveController
};