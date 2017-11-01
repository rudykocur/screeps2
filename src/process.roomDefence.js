var _ = require('lodash');

const procbase = require('process.base');
const procmgr = require('process.manager');

const utils = require('utils');

const PHASE = {
    INIT: 'init',
    INSIDE: 'inside',
    OUTSIDE: 'outside',
    FINISH: 'finish',
};

class RoomDefenceAnalysis extends procbase.ProcessBase {

    *run() {
        let room = Game.rooms[this.state.roomName];
        let mgr = room.manager;

        if(!this.state.phase) {
            this.runInit(mgr);
        }
        else {
            this.debug('Resuming work ...', this.state.phase, '::', this.state.toProcess.length);
        }

        if(this.state.phase == PHASE.INSIDE) {
            for (let step of this.runAnalyzeInside()) {
                yield;
            }
        }

        if(this.state.phase == PHASE.OUTSIDE) {
            for (let step of this.runAnalyzeOutside()) {
                yield;
            }
        }

        this.runFinish(room);
    }

    runInit(mgr) {
        let spawn = mgr.data.spawns[0];
        this.debug('Starting!', spawn, '::', spawn.pos);
        this.state.toProcess = [spawn.pos.serialize()];
        this.state.analyzedInside = [];
        this.state.inside = [];
        this.state.borders = [];
        this.state.outside = [];
        this.state.incomplete = false;
        this.state.startPostion = spawn.pos.serialize();
        this.state.errorPosition = null;

        this.state.phase = PHASE.INSIDE;
    }

    *runAnalyzeInside() {
        while(this.state.toProcess.length > 0) {
            let posStr = this.state.toProcess[0];
            let pos = RoomPosition.unserialize(posStr);

            if(this.isPosOk(pos)) {
                if(pos.isEdge()) {
                    this.state.incomplete = true;
                    this.state.errorPosition = posStr;
                    this.state.phase = PHASE.FINISH;
                    return;
                }

                let around = utils.getPositionsAround(pos);

                for(let otherPos of around){
                    let otherStr = otherPos.serialize();
                    if(this.state.analyzedInside.indexOf(otherStr) >= 0) {
                        continue;
                    }

                    if(this.state.toProcess.indexOf(otherStr) >= 0) {
                        continue;
                    }

                    this.state.toProcess.push(otherStr);
                }

                this.state.inside.push(posStr);
            }
            else {
                this.state.borders.push(posStr);
            }

            this.state.toProcess.splice(0, 1);
            this.state.analyzedInside.push(posStr);

            yield;
        }

        this.state.toProcess = this.state.borders.slice();
        this.state.phase = PHASE.OUTSIDE;
    }

    *runAnalyzeOutside() {

        while(this.state.toProcess.length > 0) {
            let posStr = this.state.toProcess[0];
            let pos = RoomPosition.unserialize(posStr);

            let points = utils.getAround(pos, 5);

            for(let otherPos of points) {
                let otherStr = otherPos.serialize();

                let terrain = _.first(otherPos.lookFor(LOOK_TERRAIN));

                if(terrain === 'wall') {
                    continue;
                }

                if(this.state.inside.indexOf(otherStr) >= 0) {
                    continue;
                }

                if(this.state.borders.indexOf(otherStr) >= 0) {
                    continue;
                }

                if(this.state.outside.indexOf(otherStr) >= 0) {
                    continue;
                }

                this.state.outside.push(otherStr);
            }

            this.state.toProcess.splice(0, 1);

            yield;
        }

        this.state.phase = PHASE.FINISH;
    }

    runFinish(room) {
        if(this.state.incomplete) {
            this.warn('Wall perimeter incomplete!', this.state.errorPosition);
            if(this.state.errorPosition) {
                let startPos = RoomPosition.unserialize(this.state.startPostion);
                let errPos = RoomPosition.unserialize(this.state.errorPosition);

                room.visual.line(startPos, errPos, {color: "red", width: 0.3});
                room.visual.circle(errPos, {opacity: 1, fill: "red", radius: 0.5});
            }
            return;
        }

        let dataSize = JSON.stringify(this.state);

        this.debug('Processing finished.', dataSize.length);

        for(let posStr of this.state.inside){
            let pos = RoomPosition.unserialize(posStr);

            room.visual.circle(pos, {fill: 'yellow'});
        }

        for(let posStr of this.state.borders){
            let pos = RoomPosition.unserialize(posStr);

            room.visual.circle(pos, {fill: 'red'});
        }

        for(let posStr of this.state.outside){
            let pos = RoomPosition.unserialize(posStr);

            room.visual.circle(pos, {fill: 'blue'});
        }
    }

    /**
     *
     * @param {RoomPosition} pos
     */
    isPosOk(pos) {
        let terrain = _.first(pos.lookFor(LOOK_TERRAIN));

        if(terrain === 'wall') {
            return false;
        }

        if(pos.isEdge()) {
            return true;
        }

        let structs = pos.lookFor(LOOK_STRUCTURES);

        for(let struct of structs) {
            if(struct.structureType === STRUCTURE_WALL || struct.structureType === STRUCTURE_RAMPART) {
                return false;
            }
        }

        return true;
    }

    toString() {
        return `[RoomDefenceAnalysis for ${this.state.roomName}]`;
    }
}

procmgr.registerProcessType(RoomDefenceAnalysis);

module.exports = {
    RoomDefenceAnalysis
};