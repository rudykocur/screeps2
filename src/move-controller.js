var _ = require('lodash');

const profiler = require('profiler');

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
        if(path.length === 0) {
            return [];
        }

        if(path.length > 13*5) {
            let idx = path.indexOf(';', 13*4);
            path = path.substr(0, idx);
        }

        let steps = path.split(';');
        return steps.map(RoomPosition.unserialize)
    }

    runPathCallback(pathCallback) {
        return pathCallback().map(this.serializeStep).join(';');
    }

    moveByPath(pathCallback) {
        if(!this.memory._moverPath) {
            this.memory._moverPath = {
                path: this.runPathCallback(pathCallback),
                currentPos: this.creep.pos,
                blockCounter: 0,
                type: 'pathfinder',
            };
        }

        if(this.creep.fatigue > 0) {
            return;
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

        if(result === OK) {
            if(path.length > 5 && !path[0].isEqualTo(this.creep.pos) && !path[1].isEqualTo(this.creep.pos)) {
                let mem = this.memory._moverPath.path;
                this.memory._moverPath.path = mem.substr(mem.indexOf(';')+1, mem.length);
            }
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
profiler.registerClass(CreepMoveController, CreepMoveController.name);

module.exports = {
    CreepMoveController
};