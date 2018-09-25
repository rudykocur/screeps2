var _ = require('lodash');
const utils = require('utils');

const profiler = require('profiler');

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

        this.flagColors = {
            [COLOR_YELLOW]: 'yellow',
            [COLOR_PURPLE]: 'purple',
            [COLOR_BLUE]: 'blue',
            [COLOR_GREEN]: 'green',
            [COLOR_BROWN]: 'brown',
            [COLOR_RED]: 'red',
            [COLOR_WHITE]: 'white',
        };
    }

    get memory() {
        return this.manager.room.memory.stats;
    }

    update() {
        this._updateDroppedEnergy();

        this.messages.push(`Room: ${this.manager.getRoomTitle()}`);
        this.messages.push(`Energy avg: ${this.manager.getAvgEnergyToPickup()}`);
        this.messages.push(`Energy capacity: ${this.room.energyAvailable}/${this.room.energyCapacityAvailable}`);

        this._updateSpawnerEnergy();
        this._updateSpawnsUsage();

        this.labs.addDiagnosticMessages(this.messages);

        this.printDiagnostics();

        let flags = [
            [COLOR_BLUE, COLOR_BLUE, 'storage'],
            [COLOR_GREEN, COLOR_GREEN, 'meeting point'],
            [COLOR_YELLOW, COLOR_YELLOW, 'extension'],
            [COLOR_YELLOW, COLOR_BROWN, 'link'],
            [COLOR_YELLOW, COLOR_RED, 'tower'],
            [COLOR_YELLOW, COLOR_PURPLE, 'spawn'],
            [COLOR_YELLOW, COLOR_WHITE, 'lab'],
            [COLOR_RED, COLOR_WHITE, 'claim room'],
            [COLOR_RED, COLOR_GREEN, 'attack room'],
        ];

        flags.forEach((flagInfo, i) => {
            this.printFlagInfo(new RoomPosition(48, 1 + i, ''), ...flagInfo);
        });
    }

    printFlagInfo(pos, primaryColor, secondaryColor, label) {

        this.room.visual.rect(pos.x - 0.4, pos.y - 0.4, 0.4, 0.8, {
            fill: this.flagColors[primaryColor],
            opacity: 1,
        });

        this.room.visual.rect(pos.x, pos.y - 0.4, 0.4 , 0.8, {
            fill: this.flagColors[secondaryColor],
            opacity: 1,
        });

        this.room.visual.rect(pos.x - 0.4, pos.y - 0.4, 0.8, 0.8, {
            stroke: 'black',
            fill: 'transparent',
            opacity: 1,
            strokeWidth: 0.05
        });

        this.room.visual.text(label, pos.x - 1, pos.y + 0.25, {
            align: 'right',
            stroke: 'black',
        });
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

            let avgData = this.memory.spawnUsage[name] || {currentValue: 100};

            avgData.currentValue = (avgData.currentValue * (1000 - 1) + (spawn.spawning?100:0)) / 1000;
            this.memory.spawnUsage[name] = avgData;

            this.messages.push(`Spawn: ${name}, usage: ${Math.round(avgData.currentValue)}%`);
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

profiler.registerClass(RoomStats, RoomStats.name);

module.exports = {
    RoomStats
};