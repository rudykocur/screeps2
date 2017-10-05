const _ = require("lodash");
const rooms = require("rooms");
const minds = require('mind');
const job_board = require('job.board');

module.exports.loop = function () {
    let jobBoard = new job_board.JobBoard();

    _.each(Memory.creeps, (creepData, creepName) => {
        if(!Game.creeps[creepName]) {
            jobBoard.handleDeadCreep(creepData);

            delete Memory.creeps[creepName];
        }
    });

    for(let name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }

    let managers = [];
    for(let i in Game.rooms) {
        let mgr = new rooms.RoomManager(Game.rooms[i], jobBoard);
        mgr.update();
        managers.push(mgr);
    }

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