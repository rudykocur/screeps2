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
            console.log(this.creep, 'regenerating cached path');
            this.memory._moverPath = {
                path: pathCallback().map(this.serializeStep).join(';'),
                currentPos: this.creep.pos,
                blockCounter: 0,
            };
        }

        let path = this.unserializePath(this.memory._moverPath.path);

        // let foundCurrentPos = false;
        //
        // for(let step of this.memory._moverPath.path) {
        //     // step.__proto__ = RoomPosition.prototype;
        //     let pos = new RoomPosition(step.x, step.y, step.roomName);
        //     path.push(pos);
        //
        //     if(pos.isEqualTo(this.creep.pos)) {
        //         foundCurrentPos = true;
        //     }
        //
        //     if(foundCurrentPos) {
        //         let vis = new RoomVisual(pos.roomName);
        //         vis.circle(pos, {fill: 'yellow'});
        //     }
        // }

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