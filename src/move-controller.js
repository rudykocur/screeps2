var _ = require('lodash');

const utils = require('utils');

const profiler = require('profiler');

/**
 * @typedef {Object} MoverMemory
 * @property {String} path
 * @property {RoomPosition} currentPos
 * @property {String} target serialized RoomPosition
 * @property {Number} blockCounter
 * @property {String} type
 */

class CreepMoveController {
    constructor(creep) {
        this.creep = creep;

        this.memory = this.creep.memory;

        /**
         * @type {MoverMemory}
         */
        this.pathMemory = this.memory._moverPath;
    }

    get blockCounter() {
        return this.memory._moverPath.blockCounter;
    }

    moveTo(target, options) {
        let result = this.creep.moveTo(target, options);
        if(result == OK) {
            this.exitStationary();
        }

        this.attemptedToMove();

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

    runPathCallback(pathCallback, target) {
        let used = Game.cpu.getUsed();
        let path;

        try {
            path = pathCallback();
            return path.map(this.serializeStep).join(';');
        }
        finally {
            // console.log(Game.time, 'Path to', target, 'calculated (length ', path && path.length,') in', (Game.cpu.getUsed() - used));
            if(path && target && Game.rooms[target.roomName]) {
                Game.rooms[target.roomName].visual.poly(path, {stroke: 'red', strokeWidth: 0.3, lineStyle: 'dashed'});
            }
        }
    }

    /**
     *
     * @param {RoomPosition|RoomObject} target
     * @param pathCallback
     */
    moveByPath(target, pathCallback) {

        if(!pathCallback && target) {
            pathCallback = target;
            target = null;
        }

        if(target && target.pos) {
            target = target.pos
        }

        this.invalidateOnTargetChange(target);

        this.initPathMemory(target, pathCallback);

        if(this.creep.fatigue > 0) {
            return ERR_TIRED;
        }

        let path = this.unserializePath(this.pathMemory.path);

        let result = this.creep.moveByPath(path);

        if(this.pathMemory.blockCounter > 4) {
            return this.invalidatePath();
        }

        if(this.pathMemory.blockCounter <= 2) {
            this.attemptedToMove();
        }

        this._updateCurrentStep(this.pathMemory);

        if(result === ERR_NOT_FOUND || result ===  ERR_INVALID_ARGS) {
            new RoomVisual(this.creep.pos.roomName).circle(this.creep.pos, {fill:'green', radius: 0.7, opacity: 1});
            delete this.memory._moverPath;
        }

        if(result === OK) {
            this.slicePathAfterMove(path);
        }

        return result;
    }

    initPathMemory(target, pathCallback) {
        if(!this.pathMemory) {
            this.memory._moverPath = this.pathMemory = {
                path: this.runPathCallback(pathCallback, target),
                currentPos: this.creep.pos,
                target: target ? target.serialize() : null,
                blockCounter: 0,
                type: 'pathfinder',
            };
        }
    }

    invalidateOnTargetChange(target) {
        if(target && this.pathMemory && this.pathMemory.target) {
            if(target.serialize() !== this.pathMemory.target) {
                this.invalidatePath();
            }
        }
    }

    invalidatePath() {
        new RoomVisual(this.creep.pos.roomName).circle(this.creep.pos, {fill:'red', radius: 0.7});
        delete this.memory._moverPath;
        this.enterStationary();

        return ERR_NO_PATH;
    }

    slicePathAfterMove(path) {
        if(path.length > 5) {

            let idx = this.getIndexOnPath(path);
            if (idx >= 0) {
                let mem = this.pathMemory.path;
                let sliceIdx = this.nthIndex(mem, ';', idx + 1);
                this.pathMemory.path = mem.substr(sliceIdx + 1, mem.length);
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
        let step = RoomPosition.asPosition(state.currentPos);

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
        this.memory.attemptedToMove = false;
        delete this.memory._moverPath;
    }

    exitStationary() {
        this.memory.attemptedToMove = true;
    }

    attemptedToMove() {
        this.memory.attemptedToMove = true;
    }
}
profiler.registerClass(CreepMoveController, CreepMoveController.name);

module.exports = {
    CreepMoveController
};