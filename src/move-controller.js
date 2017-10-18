var _ = require('lodash');

class CreepMoveController {
    constructor(creep) {
        this.creep = creep;
    }

    get memory() {
        return this.creep.memory;
    }

    setPath(path) {
        this.memory.movePath = path;
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
            this.memory._moverPath = pathCallback();
        }

        for(let step of this.memory._moverPath) {
            step.__proto__ = RoomPosition.prototype;
        }

        let result = this.creep.moveByPath(this.memory._moverPath);

        if(result === ERR_NOT_FOUND || result ===  ERR_INVALID_ARGS) {
            console.log(this.creep, ' - mover: ', result);
            delete this.memory._moverPath;
        }
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