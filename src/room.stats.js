var _ = require('lodash');
const utils = require('utils');

class RoomStats extends utils.Executable {
    /**
     *
     * @param manager
     * @param {LabManager} labs
     */
    constructor(manager, labs) {
        super();
        this.manager = manager;
        this.labs = labs;
        this.room = this.manager.room;
        this.data = manager.data;

        _.defaultsDeep(this.manager.room.memory, {stats: {
            avgEnergy: [],
            spawnUsage: {},
            spawnerMissingEnergy: [],
        }});

        this.messages = [];
    }

    get memory() {
        return this.manager.room.memory.stats;
    }

    update() {
        this._updateDroppedEnergy();

        this.messages.push(`Energy avg: ${this.manager.getAvgEnergyToPickup()}`);
        this.messages.push(`Energy capacity: ${this.room.energyCapacityAvailable}`);

        this._updateSpawnerEnergy();
        this._updateSpawnsUsage();

        this.labs.addDiagnosticMessages(this.messages);

        this.printDiagnostics();
    }

    printDiagnostics() {
        for(let i = 0; i < this.messages.length; i++){
            this.room.visual.text(this.messages[i], 0, i, {align: 'left'})
        }
    }

    _updateDroppedEnergy() {
        let toPickup = _.sum(this.data.droppedEnergy, 'amount') + _.sum(this.data.containers, c => c.store[RESOURCE_ENERGY]);
        let avg = this.memory.avgEnergy;
        avg.unshift(toPickup);

        if(avg.length > 10) {
            avg.pop();
        }
    }

    _updateSpawnsUsage() {
        for(let spawn of this.data.spawns) {
            let name = spawn.name;
            let usage = this.memory.spawnUsage[name] = this.memory.spawnUsage[name] || [];

            usage.unshift(!!spawn.spawning);

            if(usage.length > 1000) {
                usage.pop();
            }

            let totalUsage = Math.round(_.filter(usage).length / usage.length * 100);
            this.messages.push(`Spawn: ${name}, usage: ${totalUsage}%`);
        }
    }

    _updateSpawnerEnergy() {
        let usage = this.memory.spawnerMissingEnergy;

        usage.unshift(this.manager.spawner.notEnoughEnergy);

        if(usage.length > 1000) {
            usage.pop();
        }

        let totalUsage = Math.round(_.filter(usage).length / usage.length * 100);
        this.messages.push(`Missing energy: ${totalUsage}%`);
    }

    toString() {
        return `[RoomStats for ${this.manager.roomName}]`;
    }
}

module.exports = {
    RoomStats
};