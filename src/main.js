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

proto.installPrototypes();

if(!('REACTIONS_REVERSE' in global)) {
    global.REACTIONS_REVERSE = utils.reverseReactions(REACTIONS);
}

module.exports.loop = function () {
    let t1 = Game.cpu.getUsed();
    if(!Memory.counters) {
        Memory.counters = {squad: 1};
    }
    let t2 = Game.cpu.getUsed();

    // console.log(`TICK: init=${t1}, memory=${t2-t1}`);

    let initTime = Game.cpu.getUsed();

    let jobBoard = new job_board.JobBoard();

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

    _.each(Game.rooms, room => {
        maps.updateRoomCache(room, 500);
    });

    let managers = rooms.getHandlers(jobBoard);

    for(let manager of managers) {
        manager.run();
    }

    managers.forEach((manager) => {
        manager.minds.forEach((mind) => {
            mind.run();
        })
    });

    jobBoard.cleanup();

    for(let creep of _.values(Game.creeps)) {
        if(creep.memory.isStationary) {
            creep.room.visual.rect(creep.pos.x - 0.5, creep.pos.y - 0.5, 1.1, 1.1, {
                stroke: "green",
                fill: "transparent",
                opacity: 0.5,
                radius: 0.7,
            });
        }
    }

    stats.countStats(initTime, managers, jobBoard);

    utils_console.installConsoleFunctions(global);

    // sandbox.debugFun2();
    // sandbox.debugFun3();
};