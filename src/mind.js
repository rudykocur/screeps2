const profiler = require('profiler');

const availableMinds = {
    'harvester': require('mind.harvester').HarvesterMind,
    'transfer': require('mind.transfer').TransferMind,
    'upgrader': require('mind.upgrader').UpgraderMind,
    'builder': require('mind.builder').BuilderMind,
    'tower': require('mind.tower').TowerMind,
    'scout': require('mind.scout').ScoutMind,
    'defender': require('mind.defender').DefenderMind,
    'rangedDefender': require('mind.rangedDefender').RangedDefenderMind,
    'claimer': require('mind.claimer').ClaimerMind,
    'settler': require('mind.settler').SettlerMind,
    'breach': require('mind.breach').BreachMind,
    'skHunter': require('mind.sk-hunter').SKHunterMind,
    'sk-hunter': require('mind.sk-hunter').SKHunterMind,
};

module.exports = {
    getMind: function(creep, roomManager) {
        let mindType = creep.memory.mind;

        let mind = new availableMinds[mindType](creep, roomManager);

        return mind;
    },

    available: availableMinds
};

module.exports.getMind = profiler.registerFN(module.exports.getMind, module.exports.getMind.name);