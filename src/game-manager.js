var _ = require('lodash');

const rooms = require("rooms");
const utils = require('utils');
const job_board = require('job.board');
const maps = require('maps');
const roomCache = require('cache.rooms');
const utils_console = require('utils.console');
const exchange = require('room.exchange');
const procmgr = require('process.manager');
const stats = require('utis.stats');
const router = require('route.manager');
const acts = require('acts');

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

        global.manager = this;

        maps.pathTimer.reset();
        roomCache.cacheInitTimer.reset();

        let initTime = Game.cpu.getUsed().toFixed(2);

        global.tickCache = new TickCache();

        let jobBoard = new job_board.JobBoard();
        let processManager = new procmgr.ProcessManager();
        let routeManager = new router.RouteManager();

        let act = new acts.FastRCLAct();

        for(let creep of _.values(Game.creeps)) {
            creep.memory.attemptedToMove = false;
        }

        this.cleanupCreeps(jobBoard);
        this.fillTickCache(tickCache);

        let managers = rooms.getHandlers(jobBoard, processManager, routeManager);

        act.preManagersUpdate();

        this.runRoomManagers(managers);

        this.runMinds(managers);

        act.run(managers);

        jobBoard.cleanup();

        utils_console.installConsoleFunctions(global);

        this.updateRoomsCache();

        processManager.run();

        for(let creep of _.values(Game.creeps)) {
            creep.memory.isStationary = !creep.memory.attemptedToMove;

            this.visualizeStationaryCreep(creep);
        }

        let ss = stats.countStats(initTime, managers, jobBoard);



        // this.foo();

        // routeManager.registerRoute(Game.getObjectById('5bb5bf263aba4a6c79cd8377'),
        //     Game.getObjectById('5bb5f8efde5656770081e26a'));

        // routeManager.findPath(Game.flags['Flag88'],
        //     Game.getObjectById('5bb883375862ef199a13b92c'), Game.flags['FAKEPOS'].pos, true);

        // routeManager.findPath(Game.getObjectById('5bb208d5dd1bc83d07acd8a1'),
        //     Game.getObjectById('5bb1d51f05ce520fc1a6fa4f'), Game.flags['FAKEPOS'].pos, true);

        this.showPerfStats(ss, maps.pathTimer, roomCache.cacheInitTimer);
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

    runRoomManagers(managers) {
        let exch = new exchange.InterRoomExchange(managers);
        exch.run();

        for(let manager of managers) {
            manager.run(exch);
        }
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

    showPerfStats(stats, timer, cacheTimer) {
        let mindAvg = (stats['mind.total'] / stats['mind.totalCount']).toFixed(2);
        let messages = [
            `Tick: ${stats['cpu.getUsed']}: jobs=${stats['jobBoard.update']}, jobFind=${stats['jobBoard.find']}x${stats['jobBoard.findCount']}, minds=${mindAvg}, ` +
            `rooms=${stats['manager.total']}, init=${stats['initTime']}`,
            `Path timer: ${timer}`,
            `Cache timer: ${cacheTimer}`,
        ];

        this.printDiagnostics(messages);
    }

    printDiagnostics(messages) {
        let visual = new RoomVisual();
        for(let i = 0; i < messages.length; i++){
            visual.text(messages[i], 0, 48-i, {align: 'left', stroke: 'black'})
        }
    }

    foo() {
        let lz = require('lz-string');

        let data = JSON.stringify(Memory.cache.rooms);

        let t1 = Game.cpu.getUsed();
        let compressed = lz.compress(data);
        let t2 = Game.cpu.getUsed();

        console.log('COMPRESS', compressed.length, '::', data.length, '::', t2-t1);
        // // let from = new RoomPosition(10, 17, 'W31N14');
        // // // let from = new RoomPosition(9, 16, 'W31N14');
        // // // let to = new RoomPosition(20, 12, 'W32N13');
        // // let to = new RoomPosition(40, 41, 'W32N13');
        //
        // // let from = new RoomPosition(10, 17, 'W31N14');
        // // let to = new RoomPosition(40, 41, 'W32N13');
        // // let to = new RoomPosition(10, 17, 'W31N14');
        // let from = new RoomPosition(3, 40, 'W34N18');
        // // let from = Game.getObjectById('5baf8c3a82ec0133f5f47e33').pos;
        // // let to = Game.getObjectById('59f1a0b382100e1594f370de').pos;
        // let to = new RoomPosition(25, 25, 'W36N19');
        //
        // // let rooms = Game.map.findRoute(from.roomName, to.roomName);
        // //
        //
        // let options = _.defaults({}, {
        //     targetRange: 0,
        //     cutoffRange: 0,
        //     withTarget: false,
        // });
        //
        // let path = maps.getMultiRoomPath(from, to, {
        //     debug:true,
        //     visualize: false,
        //     allowSKRooms: false
        // });
        //
        // utils.debugPath(path);

    }

    foo2(ticks) {
        let unused = _.filter(Memory.cache.rooms,
                data => (Game.time - data.lastAccessTime) > ticks);

        let used = _.filter(Memory.cache.rooms,
                data => (Game.time - data.lastAccessTime) <= ticks);

        let usedData = _.sum(used, data => data.dataJSON.length);
        let unusedData = _.sum(unused, data => data.dataJSON.length);

        this.debug(`USED/UNUSED IN LAST ${ticks} - used: ${used.length} (${usedData} b), 
            unused: ${unused.length} (${unusedData} b)
            out of total: ${_.size(Memory.cache.rooms)}
            Used: ${_.sortBy(used.map(data=>Game.rooms[data.roomName]&&Game.rooms[data.roomName].manager||data.roomName))}
            Unused: ${_.sortBy(unused.map(data=>data.roomName))}`);
    }

    toString() {
        return '[GameManager]';
    }
}

profiler.registerClass(GameManager, GameManager.name);

module.exports = {
    GameManager
};