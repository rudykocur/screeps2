var _ = require("lodash");
const profiler = require('profiler');

class Timer {
    constructor() {
        this.reset();
    }

    reset() {
        this._usedTime = 0;
        this.usedTimeStart = 0;
        this.counts = 0;
    }

    get usedTime() {
        // return this._usedTime;
        return Number(this._usedTime).toFixed(2);
    }

    start() {
        this.usedTimeStart = Game.cpu.getUsed();
        return this;
    }

    count(callback) {
        this.start();
        callback();
        this.stop();
    }

    stop() {
        this.counts += 1;
        this._usedTime += Game.cpu.getUsed() - this.usedTimeStart;

        return this.usedTime;
    }

    toString() {
        return `(x${this.counts})=${this.usedTime}`;
    }
}

class NamedTimer {
    constructor(names) {
        this.timers = {};
        this.defaultTimers = names;

        if(names) {
            names.forEach(name => this.timers[name] = new Timer())
        }
    }

    reset() {
        this.timers = {};

        if(this.defaultTimers) {
            this.defaultTimers.forEach(name => this.timers[name] = new Timer())
        }
    }

    start(name) {
        if(!this.timers[name]) {
            this.timers[name] = new Timer();
        }
        this.timers[name].start();

        return this;
    }

    stop(name) {
        this.timers[name].stop();
        return this;
    }

    toString() {
        let times = [];
        let total = 0;
        _.each(this.timers, (timer, name) => {
            total += timer._usedTime;
            times.push(`${name} (x${timer.counts})=${timer.usedTime}`);
        });
        return `TOTAL: ${total.toFixed(2)}; `+times.join(', ');
    }

    get usedTime() {
        return _.sum(this.timers, t => t.usedTime);
    }
}

class Stopwatch {
    constructor() {
        this.lapStart = null;
        this.laps = [];
    }

    start() {
        this.lapStart = Game.cpu.getUsed();
    }

    lap(label) {
        this.laps.push({label: label, time: Game.cpu.getUsed() - this.lapStart});
        this.lapStart = Game.cpu.getUsed();
    }

    print() {
        let total = 0;
        for(let lap of this.laps) {
            console.log('    ', lap.label, 'took', lap.time);
            total += lap.time;
        }

        console.log('TOTAL:', total);
    }
}

class Loggable {
    err(...messages) {
        messages.unshift(`<span style="color:lightcoral; font-weight: bold;">[ERROR] ${this}</span>`);

        console.log.apply(console, messages);
    }

    warn(...messages) {
        messages.unshift(`<span style="color:gold; font-weight: bold;">[WARN] ${this}</span>`);

        console.log.apply(console, messages);
    }

    info(...messages) {
        messages.unshift(`<span style="color:springgreen; font-weight: bold;">[INFO] ${this}</span>`);

        console.log.apply(console, messages);
    }

    important(...messages) {
        messages.unshift(`<span style="color:deepskyblue; font-weight: bold;">[INFO] ${this}</span>`);

        console.log.apply(console, messages);
    }

    debug(...messages) {
        messages.unshift(`<span style="color:slategray; font-weight: bold;">[DEBUG] ${this}</span>`);

        console.log.apply(console, messages);
    }
}

class Executable extends Loggable{
    constructor() {
        super();

        this._init();
    }

    _init() {
        this.updateTime = null;
        this.timer = new Timer();
        this.stopwatch = new Stopwatch();
    }

    update() {}

    safeRun(callback) {
        try{
            callback();
        }
        catch(e) {
            console.log('Executable safeRun failed:', this, '::', e, 'Stack trace:', e.stack);
            Game.notify(`Executable safeRun failed: ${this} :: ${e}. Stack trace: ${e.stack}`, 30);
        }
    }

    run(...args) {
        try{
            let tStart = Game.cpu.getUsed();
            this.update(...args);
            this.updateTime = Game.cpu.getUsed() - tStart;
        }
        catch(e) {
            console.log('Executable failed:', this, '::', e, 'Stack trace:', e.stack);
            Game.notify(`Executable failed: ${this} :: ${e}. Stack trace: ${e.stack}`, 30);
        }
    }
}

let DataMatrix = function() {
    this._bits = new Uint16Array(2500);
};

DataMatrix.prototype.set = function(xx, yy, val) {
    xx = xx|0;
    yy = yy|0;
    this._bits[xx * 50 + yy] = Math.min(Math.max(0, val), 32767);
};

DataMatrix.prototype.get = function(xx, yy) {
    xx = xx|0;
    yy = yy|0;
    return this._bits[xx * 50 + yy];
};

DataMatrix.prototype.clone = function() {
    let newMatrix = new DataMatrix;
    newMatrix._bits = new Uint16Array(this._bits);
    return newMatrix;
};

DataMatrix.prototype.serialize = function() {
    return Array.prototype.slice.apply(new Uint32Array(this._bits.buffer));
};

DataMatrix.deserialize = function(data) {
    let instance = Object.create(DataMatrix.prototype);
    instance._bits = new Uint16Array(new Uint32Array(data).buffer);
    return instance;
};

profiler.registerClass(Executable, Executable.name);

module.exports = {
    Executable, Timer, NamedTimer, Stopwatch, Loggable, DataMatrix,

    throttle(ticks, callback) {
        return () => {
            if (Game.time % ticks === 0) {
                callback();
            }
        }
    },

    every(ticks, callback) {
        if (Game.time % ticks === 0) {
            callback();
        }
    },

    everyMod(ticks, id, callback) {
        if (Game.time % (ticks + parseInt(id, 16) % 21) === 0) {
            callback();
        }
    },

    round (number, precision) {
        let factor = Math.pow(10, precision);
        let tempNumber = number * factor;
        let roundedTempNumber = Math.round(tempNumber);
        return roundedTempNumber / factor;
    },

    myUsername() {
        if(!Memory.myUsername) {
            let myRoom = _.first(_.filter(Game.rooms, r => r.controller && r.controller.my));

            Memory.myUsername = myRoom.controller.owner.username;
        }

        return Memory.myUsername
    },

    /**
     * @param {RoomPosition} center
     */
    getPositionsAround(center) {
        return [
            new RoomPosition(center.x -1, center.y -1, center.roomName),
            new RoomPosition(center.x -1, center.y, center.roomName),
            new RoomPosition(center.x -1, center.y +1, center.roomName),
            new RoomPosition(center.x, center.y -1, center.roomName),
            new RoomPosition(center.x, center.y +1, center.roomName),
            new RoomPosition(center.x +1, center.y -1, center.roomName),
            new RoomPosition(center.x +1, center.y, center.roomName),
            new RoomPosition(center.x +1, center.y +1, center.roomName),
        ];
    },

    getAround(center, radius) {
        let result = [];

        for(let i = radius*-1; i <= radius; i++) {
            for(let j = radius*-1; j <= radius; j++) {
                if(i === 0 && j === 0) {
                    continue;
                }

                let x = center.x + i;
                let y = center.y + j;



                if(x < 1 || x > 49 || y < 1 || y > 49) {
                    continue;
                }

                result.push(new RoomPosition(x, y, center.roomName));
            }
        }

        return result;
    },

    iterRoomPoints: function(callback) {
        for(let x = 0; x < 50; x++) {
            for(let y = 0; y < 50; y++) {
                callback(x, y);
            }
        }
    },

    /**
     * @param {RoomPosition} pos
     */
    hasRoad(pos) {
        return pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_ROAD).length > 0;
    },

    hasRampart(pos) {
        return pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART).length > 0;
    },

    reverseReactions(reactions) {
        let results = {};

        _.each(reactions, (other, firstResource) => {
            _.each(other, (finalResource, secondResource) => {
                if(finalResource in results) {
                    return;
                }
                results[finalResource] = [firstResource, secondResource];
            })
        });

        return results;
    },

    getNextReaction(resource, amount, store) {

        let neededAmount = amount - (store[resource] || 0);

        store = _.omit(store, resource);

        if((store[resource] || 0) >= amount) {
            return null;
        }

        let toCheck = [REACTIONS_REVERSE[resource]];

        while(toCheck.length > 0) {
            let reaction = toCheck.pop();

            if((store[reaction[0]] || 0) < neededAmount && RESOURCES_BASE.indexOf(reaction[0]) < 0) {
                toCheck.push(REACTIONS_REVERSE[reaction[0]]);
                continue;
            }

            if((store[reaction[1]] || 0) < neededAmount && RESOURCES_BASE.indexOf(reaction[1]) < 0) {
                toCheck.push(REACTIONS_REVERSE[reaction[1]]);
                continue;
            }

            return reaction;
        }
    },

    debugPath(path) {
        let rooms = _.unique(path.map(pos => pos.roomName));

        for(let roomName of rooms) {
            let points = path.filter(pos => pos.roomName === roomName);

            new RoomVisual(roomName).poly(points, {
                lineStyle: 'dashed',
                stroke: 'yellow',
                strokeWidth: 0.2,
            });
        }
    },

    getPathTarget(targets, path) {
        let last = path[path.length - 1];

        for(let target of targets) {
            if(target.pos.isNearTo(last)) {
                return target;
            }
        }
    },

    roomNameToInt(name) {
        if(name === 'sim') {
            return 31;
        }
        return parseInt(name.replace('W', 'A').replace('E', 'B').replace('N', 'C').replace('S', 'D'), 16)
    },

    parseRoomName(roomName) {
        let matches = roomName.match(/\w(\d+)\w(\d+)/);

        return {
            x: matches[1],
            y: matches[2],
        }
    },

    getRoomLink(roomName, linkTitle) {
        return `<a href="#!/room/${Game.shard.name}/${roomName}" style="color: inherit; font-style: italic; ;">${linkTitle}</a>`
    }
};