var _ = require("lodash");
const rooms = require("rooms");
const utils = require('utils');
const job_board = require('job.board');
const proto = require('prototypes');
const maps = require('maps');

proto.installPrototypes();

if(!('REACTIONS_REVERSE' in global)) {
    global.REACTIONS_REVERSE = utils.reverseReactions(REACTIONS);
}

module.exports.loop = function () {
    if(!Memory.counters) {
        Memory.counters = {squad: 1};
    }

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

    let managers = [];
    _.each(Game.rooms, room => {
        if(!room.controller.my) {
            return;
        }

        let mgr = new rooms.RoomManager(room, jobBoard);
        mgr.run();
        managers.push(mgr);
    });

    managers.forEach((manager) => {
        manager.minds.forEach((mind) => {
            mind.run();
        })
    });

    jobBoard.cleanup();

    // utils.debugFun(maps, utils);
};