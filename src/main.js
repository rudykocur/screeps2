const _ = require("lodash");
const rooms = require("rooms");
const minds = require('mind');
const job_board = require('job.board');
const proto = require('prototypes');

proto.installPrototypes();

module.exports.loop = function () {
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

    let managers = [];
    _.each(Game.rooms, room => {
        if(!room.controller.my) {
            return;
        }

        let mgr = new rooms.RoomManager(room, jobBoard);
        mgr.update();
        managers.push(mgr);
    });

    managers.forEach((manager) => {
        manager.minds.forEach((mind) => {
            try{
                mind.update();
            }
            catch(e) {
                console.log('MIND FAILED:', e, 'Stack trace:', e.stack);
            }
        })
    });

    jobBoard.cleanup();
};