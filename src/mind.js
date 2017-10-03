
const availableMinds = {
    'harvester': require('mind.harvester').HarvesterMind,
    'transfer': require('mind.transfer').TransferMind,
    'upgrader': require('mind.upgrader').UpgraderMind,
    'builder': require('mind.builder').BuilderMind,
};

module.exports = {
    getMind: function(creep, roomManager) {
        let mindType = creep.memory.mind;

        let mind = new availableMinds[mindType](creep, roomManager);

        return mind;
    },

    available: availableMinds
};