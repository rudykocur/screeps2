

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
        if(this.creep.moveTo(target, options) == OK) {
            this.exitStationary();
        }
    }

    moveByPath() {}

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