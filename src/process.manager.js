var _= require('lodash');

const utils = require('utils');

let processTypes = {};

class ProcessManager extends utils.Executable {
    constructor() {
        super();

        Memory.processManager = Memory.processManager || {};
        _.defaultsDeep(this.memory, {queue: []});

        this.connections = {};
        this.processes = [];

        this.startIndex = 0;
    }

    get memory() {
        return Memory.processManager;
    }

    update() {
        let process, procGen;

        while(Game.cpu.getUsed() + 5 < Game.cpu.limit) {
            if(!process) {
                process = this.getNextProcess();
            }

            if(!process) {
                break;
            }
            else if(!procGen) {
                procGen = process.run();
                this.debug('Running process', process);
            }

            try {
                let step  = procGen.next();

                if(step.done) {
                    this.debug('Process', process, 'is completed');
                    this.memory.queue.splice(this.startIndex, 1);
                    process = procGen = null;
                }
            }
            catch(e) {
                this.warn('Process failed, skipping:', process, '::', e, 'Stack trace:', e.stack);
                Game.notify(`Process failed: ${process} :: ${e}. Stack trace: ${e.stack}`, 5);

                process = procGen = null;
                this.startIndex += 1;
            }
        }
    }

    /**
     * @param {ProcessBase} process
     */
    addProcess(process) {
        this.memory.queue.push(process.serialize());
    }

    connectToProcess(processId, callback) {
        this.connections[processId] = {
            callback: callback,
        }
    }

    getNextProcess() {
        if(this.memory.queue.length <= this.startIndex) {
            return null;
        }

        let processData = this.memory.queue[this.startIndex];

        let clazz = processTypes[processData.type];

        return new clazz(processData.id, processData.state);
    }

    toString() {
        return '[ProcessManager]';
    }
}

module.exports = {
    ProcessManager,
    registerProcessType(processClass) {
        processTypes[processClass.name] = processClass;
    }
};