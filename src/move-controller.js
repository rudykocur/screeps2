var _ = require('lodash');

const utils = require('utils');

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

        let steps = this.getSlicedPath(path).split(';');
        return steps.map(RoomPosition.unserialize)
    }

    getSlicedPath(path) {
        if(path.length > 13*8) {
            let idx = path.indexOf(';', 13*7);
            return path.substring(0, idx);
        }

        return path;
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

        //utils.debugPath(path);

        let result = this.creep.moveByPath(path);

        if(this.memory._moverPath.blockCounter > 4) {
            new RoomVisual(this.creep.pos.roomName).circle(this.creep.pos, {fill:'red', radius: 0.7});
            delete this.memory._moverPath;
            this.enterStationary();
            return;
        }

        this._updateCurrentStep(this.memory._moverPath);

        if(result === ERR_NOT_FOUND || result ===  ERR_INVALID_ARGS) {
            new RoomVisual(this.creep.pos.roomName).circle(this.creep.pos, {fill:'green', radius: 0.7, opacity: 1});
            delete this.memory._moverPath;
        }

        if(result === OK) {
            if(path.length > 5) {

                let idx = this.getIndexOnPath(path);
                if(idx >= 0) {
                    let mem = this.memory._moverPath.path;
                    let sliceIdx = this.nthIndex(mem, ';', idx + 1);
                    this.memory._moverPath.path = mem.substr(sliceIdx+1, mem.length);
                }

            }
        }
    }

    getIndexOnPath(path) {
        for(let i = 0; i < path.length; i++) {
            if(this.creep.pos.isEqualTo(path[i])) {
                return i;
            }
        }

        return -1;
    }

    nthIndex(str, pat, n){
        let L= str.length, i= -1;
        while(n-- && i++<L){
            i= str.indexOf(pat, i);
            if (i < 0) break;
        }
        return i;
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