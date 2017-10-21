var _ = require('lodash');

const utils = require('utils');

function countUpdateTime(objects) {
    let times = {};
    _.each(objects, obj => {
        if(!obj) {
            return;
        }

        let time = obj.updateTime;
        let mind = obj.constructor.name;

        if(!times[mind]) {
            times[mind] = time;
        }
        else {
            times[mind] += time;
        }
    });

    return times;
}

function countTimers(objects) {
    let times = {};
    _.each(objects, obj => {
        if(!obj) {
            return;
        }

        let time = obj.timer.usedTime;
        let mind = obj.constructor.name;

        if(!times[mind]) {
            times[mind] = time;
        }
        else {
            times[mind] += time;
        }
    });

    return times;
}

module.exports.countStats = function(initTime, managers, jobBoard) {
    _.defaultsDeep(Memory, {stats: {mindsCount: {}, mindsTimes: {}}});
    Memory.stats['username'] = utils.myUsername();

    Memory.stats['cpu.getUsed'] = Game.cpu.getUsed();
    Memory.stats['cpu.limit'] = Game.cpu.limit;
    Memory.stats['cpu.bucket'] = Game.cpu.bucket;

    let toStat = managers.slice();
    for(let mgr of managers) {
        if(mgr.remote && mgr.remote.handlers) {
            // toStat = toStat.concat(toStat, mgr.remote.handlers)
            for(let remote of mgr.remote.handlers) {
                toStat.push(remote);
            }
        }
    }

    // console.log('TOSTAT', toStat);
    let minds = _.map(Game.creeps, c => c.mind);
    let mindTimes = countUpdateTime(minds);
    let managersTimes = countTimers(toStat);
    let mindCounts = _.countBy(minds, mind => mind && mind.constructor.name);

    Memory.stats['mind.times'] = mindTimes;
    Memory.stats['mind.total'] = _.sum(mindTimes);
    Memory.stats['mind.count'] = mindCounts;
    Memory.stats['mind.avgTimes'] = _.transform(mindTimes, (result, time, name) => {
        result[name] = time / mindCounts[name];
    });

    Memory.stats['manager.times'] = managersTimes;
    Memory.stats['manager.total'] = _.sum(managersTimes);

    Memory.stats['jobBoard.update'] = jobBoard.updateTimer.usedTime;
    Memory.stats['initTime'] = initTime;
};