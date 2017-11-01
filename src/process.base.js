
const utils = require('utils');

class ProcessBase extends utils.Loggable {
    constructor(processId, state) {
        super();
        
        this.processId = processId;
        this.state = state || {};
    }

    *run() {

    }

    serialize() {
        return {
            id: this.processId,
            state: this.state,
            type: this.constructor.name,
        }
    }
}

module.exports = {
    ProcessBase
};