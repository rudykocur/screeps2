var _ = require('lodash');

const rooms = require("rooms");
const utils = require('utils');
const job_board = require('job.board');
const maps = require('maps');
const utils_console = require('utils.console');
const exchange = require('room.exchange');
const procmgr = require('process.manager');
const stats = require('utis.stats');
const pathCache = require('pathCache');

const profiler = require('profiler');

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

class GameManager extends utils.Executable {

    update() {
        this.initMemory();

        let initTime = Game.cpu.getUsed().toFixed(2);

        global.tickCache = new TickCache();

        let jobBoard = new job_board.JobBoard();
        let processManager = new procmgr.ProcessManager();

        for(let creep of _.values(Game.creeps)) {
            creep.memory.attemptedToMove = false;
        }

        this.cleanupCreeps(jobBoard);
        this.fillTickCache(tickCache);

        let managers = this.runRoomManagers(jobBoard, processManager);

        this.runMinds(managers);

        jobBoard.cleanup();

        utils_console.installConsoleFunctions(global);

        this.updateRoomsCache();

        utils.every(121, () => pathCache.cleanupCache());

        processManager.run();

        for(let creep of _.values(Game.creeps)) {
            creep.memory.isStationary = !creep.memory.attemptedToMove;

            this.visualizeStationaryCreep(creep);
        }

        let ss = stats.countStats(initTime, managers, jobBoard);

        this.showPerfStats(ss);
    }

    initMemory() {
        if(!Memory.counters) {
            Memory.counters = {squad: 1};
        }
    }

    cleanupCreeps(jobBoard) {
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
    }

    fillTickCache(tickCache) {
        let creepsByRoom = _.groupBy(Game.creeps, 'memory.roomName');
        _.each(creepsByRoom, (creeps, roomName) => {
            tickCache.set('creeps-'+roomName, creeps);
        });

        let constructionsByRoom = _.groupBy(Game.constructionSites, 'pos.roomName');
        _.each(constructionsByRoom, (sites, roomName) => {
            tickCache.set('sites-'+roomName, sites);
        });
    }

    updateRoomsCache() {
        _.each(Game.rooms, room => {
            maps.updateRoomCache(room, 500);
        });
    }

    runRoomManagers(jobBoard, processManager) {
        let managers = rooms.getHandlers(jobBoard, processManager);

        let exch = new exchange.InterRoomExchange(managers);
        exch.run();

        for(let manager of managers) {
            manager.run(exch);
        }

        return managers;
    }

    runMinds(managers) {
        managers.forEach((manager) => {
            manager.getAllMinds().forEach((mind) => {
                mind.run();
            })
        });
    }

    /**
     * @param {Creep} creep
     */
    visualizeStationaryCreep(creep) {
        if(creep.spawning) {
            return;
        }

        if (creep.memory.isStationary) {
            creep.room.visual.rect(creep.pos.x - 0.55, creep.pos.y - 0.55, 1.1, 1.1, {
                stroke: "green",
                fill: "transparent",
                opacity: 0.8,
                strokeWidth: 0.15,
            });
        }
    }

    showPerfStats(stats) {
        let mindAvg = (stats['mind.total'] / stats['mind.totalCount']).toFixed(2);
        let messages = [
            `Tick: ${stats['cpu.getUsed']}: jobs=${stats['jobBoard.update']}, minds=${mindAvg}, ` +
            `rooms=${stats['manager.total']}, init=${stats['initTime']}`,
        ];

        this.printDiagnostics(messages);
    }

    printDiagnostics(messages) {
        let visual = new RoomVisual();
        for(let i = 0; i < messages.length; i++){
            visual.text(messages[i], 0, 48-i, {align: 'left', stroke: 'black'})
        }
    }

    toString() {
        return '[GameManager]';
    }
}

profiler.registerClass(GameManager, GameManager.name);

module.exports = {
    GameManager
};