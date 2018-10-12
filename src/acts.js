var _ = require('lodash');

const utils = require('utils');
const flags = require('utils.flags');

const profiler = require('profiler');

class Act extends utils.Executable {
    constructor(name) {
        super();

        if(!('acts' in Memory)) {
            Memory.acts = {};
        }

        if(!(name in Memory.acts)) {
            Memory.acts[name] = {};
        }

        this.memory = Memory.acts[name];
    }
}

class FastRCLAct extends Act {

    constructor() {
        super('fastRCL');

        this.minStorageEnergy = 20000;
        this.minTerminalEnergy = 20000;
        this.lowThresholdTerminalEnergy = 60000;
    }

    /**
     * @param {Array<RoomManager>} managers
     */
    update(managers) {
        utils.every(23, () => this.aidRoom(managers));
    }

    /**
     * @param {Array<RoomManager>} managers
     */
    aidRoom(managers) {
        let qualified = this.qualifyManagers(managers);

        /**
         * @type {RoomManager}
         */
        let toSupport = this.pickRoomToSupport(qualified);

        if(!toSupport) {
            return;
        }


        if(toSupport.room.terminal.store[RESOURCE_ENERGY] > this.lowThresholdTerminalEnergy) {
            return;
        }

        /**
         * @type {Array<RoomManager>}
         */
        let supportingRooms = _.without(qualified, toSupport);

        let readyRooms = supportingRooms
            .filter(mgr => mgr.room.terminal.cooldown === 0)
            .filter(mgr => mgr.room.storage.store[RESOURCE_ENERGY] > this.minStorageEnergy
                && mgr.room.terminal.store[RESOURCE_ENERGY] > this.minTerminalEnergy);

        for(let mgr of readyRooms) {
            let cost = Game.market.calcTransactionCost(this.minTerminalEnergy, mgr.roomName, toSupport.roomName);

            let toSend = this.minTerminalEnergy - cost;

            let sendResult = mgr.room.terminal.send(RESOURCE_ENERGY, toSend, toSupport.roomName);
            if (sendResult === OK) {
                this.important(`Sent aid from ${mgr} to ${toSupport}: ${toSend} energy`);
                break;
            }
        }
    }

    /**
     * @param {Array<RoomManager>} managers
     */
    qualifyManagers(managers) {
        return managers.filter(mgr => mgr.room && mgr.room.controller.my && mgr.room.controller.level >= 6
            && mgr.room.terminal);
    }

    /**
     * @param {Array<RoomManager>} managers
     */
    pickRoomToSupport(managers) {
        if(!this.memory.supportingRoom) {
            let toSupport = managers.filter(mgr => mgr.room && mgr.flags && mgr.flags.filter(flags.isFastRCLAct).length > 0);

            toSupport = _.sortByOrder(toSupport, ['room.controller.level', 'room.controller.progress'], ['asc', 'desc']);

            let mgr = _.first(toSupport);

            this.memory.supportingRoom = {
                roomName: mgr.room.name,
                rcl: mgr.room.controller.level,
            };

            this.important('Will now support room', mgr, 'at level', mgr.room.controller.level);
        }

        let room = Game.rooms[this.memory.supportingRoom.roomName];

        if(!room) {
            this.warn(Game.time, 'No room', this.memory.supportingRoom.roomName, '::', JSON.stringify(this.memory));
            return null;
        }

        let roomManager = room.manager;

        if(roomManager.room.controller.level !== this.memory.supportingRoom.rcl) {
            this.important('Supported room upgraded! Changing support ...');
            delete this.memory.supportingRoom;

            return null;
        }

        return roomManager;
    }

    toString() {
        return `[FastRCLAct]`;
    }
}

profiler.registerClass(FastRCLAct, FastRCLAct.name);

module.exports = {
    FastRCLAct
};