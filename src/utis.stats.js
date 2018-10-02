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
    let result = {};

    result['username'] = utils.myUsername();

    result['cpu.getUsed'] = Game.cpu.getUsed().toFixed(2);
    result['cpu.limit'] = Game.cpu.limit;
    result['cpu.bucket'] = Game.cpu.bucket;

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

    result['mind.times'] = mindTimes;
    result['mind.total'] = _.sum(mindTimes).toFixed(2);
    result['mind.count'] = mindCounts;
    result['mind.totalCount'] = minds.length;
    result['mind.avgTimes'] = _.transform(mindTimes, (result, time, name) => {
        result[name] = time / mindCounts[name];
    });

    result['manager.times'] = managersTimes;
    result['manager.total'] = _.sum(managersTimes).toFixed(2);

    result['jobBoard.update'] = jobBoard.updateTimer.usedTime.toFixed(2);
    result['initTime'] = initTime;

    return result;
};