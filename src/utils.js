var _ = require("lodash");

class Timer {
    constructor() {
        this.usedTime = 0;
        this.usedTimeStart = 0;
        this.counts = 0;
    }

    start() {
        this.usedTimeStart = Game.cpu.getUsed();
    }

    count(callback) {
        this.start();
        callback();
        this.stop();
    }

    stop() {
        this.counts += 1;
        this.usedTime += Game.cpu.getUsed() - this.usedTimeStart;
    }
}

class NamedTimer {
    constructor() {
        this.timers = {};
    }

    start(name) {
        if(!this.timers[name]) {
            this.timers[name] = new Timer();
        }
        this.timers[name].start();
    }

    stop(name) {
        this.timers[name].stop();
    }

    toString() {
        let times = [];
        let total = 0;
        _.each(this.timers, (timer, name) => {
            total += timer.usedTime;
            times.push(`${name} (x${timer.counts})=${timer.usedTime.toFixed(2)}`);
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

        this.updateTime = null;
        this.timer = new Timer();
        this.stopwatch = new Stopwatch();
    }

    update() {}

    run(...args) {
        try{
            let tStart = Game.cpu.getUsed();
            this.update(...args);
            this.updateTime = Game.cpu.getUsed() - tStart;
        }
        catch(e) {
            console.log('Executable failed:', this, '::', e, 'Stack trace:', e.stack);
            Game.notify(`Executable failed: ${this} :: ${e}. Stack trace: ${e.stack}`, 5);
        }
    }
}

module.exports = {
    Executable, Timer, NamedTimer, Stopwatch, Loggable,

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
        let myRoom = _.first(_.filter(Game.rooms, r => r.controller && r.controller.my));

        return myRoom.controller.owner.username;
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
        for(let step of path) {

            let visual = new RoomVisual(step.roomName);
            visual.circle(step, {
                fill: "yellow",
                opacity: 0.3
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
        return parseInt(name.replace('W', 'A').replace('E', 'B').replace('N', 'C').replace('S', 'D'), 16)
    }
};