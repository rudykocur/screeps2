var _ = require("lodash");
const rooms = require("rooms");
const utils = require('utils');
let flags = require('utils.flags');
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
        if(!room.controller || !room.controller.my) {
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

    for(let creep of _.values(Game.creeps)) {
        if(creep.memory.isStationary) {
            creep.room.visual.circle(creep.pos, {
                fill: "green",
                opacity: 0.5,
                radius: 0.5,
            })
        }
    }

    _.defaultsDeep(Memory, {stats: {spawns: {}}});
    _.each(Game.spawns, (spawn, name) => {
        let list = Memory.stats.spawns[name] = Memory.stats.spawns[name] || [];

        list.unshift(!!spawn.spawning);

        if(list.length > 1000) {list.pop();}

        let usage = Math.round(_.filter(list).length / list.length * 100);
        spawn.room.visual.text(usage+'%', spawn.pos.x, spawn.pos.y+0.5, {color: 'red', stroke: 'white'});
    });

    let claimFlag = _.first(_.filter(Game.flags, flags.isClaim));

    if(claimFlag) {
        let wanderer = Game.creeps.wanderer;
        if(!wanderer) {
            for(let spawn of _.values(Game.spawns)) {
                if(spawn.spawnCreep([MOVE], 'wanderer') === OK) {
                    console.log('spawned wanderer');
                    break;
                }
            }
        }
        else {


            let claimPath = maps.getMultiRoomPath(wanderer.pos, claimFlag.pos);
            let x = wanderer.moveByPath(claimPath);
        }
    }
};