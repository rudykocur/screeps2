var _ = require("lodash");
const rooms = require("rooms");
const utils = require('utils');
let flags = require('utils.flags');
const job_board = require('job.board');
const proto = require('prototypes');
const maps = require('maps');
const stats = require('utis.stats');
const sandbox = require('utils.sandbox');
const utils_console = require('utils.console');
const exchange = require('room.exchange');
const procmgr = require('process.manager');

proto.installPrototypes();

if(!('REACTIONS_REVERSE' in global)) {
    global.REACTIONS_REVERSE = utils.reverseReactions(REACTIONS);
}

const profiler = require('profiler');
// profiler.enable();

class TickCache {
    constructor(){
        this.cache = {};
    }

    get(key, callback, defaultValue) {
        if(!this.cache[key]) {
            if(!callback) {
                if(!defaultValue) {
                    throw new Error('No callback in TickCache.get');
                }

                return defaultValue;
            }
            this.cache[key] = callback();
        }

        return this.cache[key];
    }

    set(key, value) {
        this.cache[key] = value;
    }
}

module.exports = {
    loop: function() {
        if(profiler.isEnabled()) {
            profiler.wrap(module.exports.run);
        }
        else {
            module.exports.run();
        }
    },

    run: function () {
        let t1 = Game.cpu.getUsed();
        if(!Memory.counters) {
            Memory.counters = {squad: 1};
        }
        let t2 = Game.cpu.getUsed();

        global.tickCache = new TickCache();

        // console.log(`TICK: init=${t1}, memory=${t2-t1}`);

        let initTime = Game.cpu.getUsed();

        let jobBoard = new job_board.JobBoard();
        let processManager = new procmgr.ProcessManager();

        _.each(Memory.creeps, (creepData, creepName) => {
            if(!Game.creeps[creepName]) {
                jobBoard.handleDeadCreep(creepName, creepData);

                delete Memory.creeps[creepName];
            }
        });

        for(let name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }

        for(let creep of _.values(Game.creeps)) {
            creep.memory.isStationary = true;
        }

        let creepsByRoom = _.groupBy(Game.creeps, 'memory.roomName');
        _.each(creepsByRoom, (creeps, roomName) => {
            tickCache.set('creeps-'+roomName, creeps);
        });

        _.each(Game.rooms, room => {
            maps.updateRoomCache(room, 500);
        });

        let managers = rooms.getHandlers(jobBoard, processManager);

        let exch = new exchange.InterRoomExchange(managers);
        exch.run();

        for(let manager of managers) {
            manager.run(exch);
        }

        managers.forEach((manager) => {
            manager.getAllMinds().forEach((mind) => {
                mind.run();
            })
        });

        jobBoard.cleanup();

        for(let creep of _.values(Game.creeps)) {
            if(creep.memory.isStationary) {
                creep.room.visual.rect(creep.pos.x - 0.55, creep.pos.y - 0.55, 1.1, 1.1, {
                    stroke: "green",
                    fill: "transparent",
                    opacity: 0.8,
                    strokeWidth: 0.15,
                });
            }
        }

        stats.countStats(initTime, managers, jobBoard);

        utils_console.installConsoleFunctions(global);

        processManager.run();

        // sandbox.debugFun2();
        // sandbox.debugFun3();
    }
};