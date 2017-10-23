var _ = require('lodash');

const utils = require('utils');

// const minds = require('mind');
const jobModules = {};

[
    'job.pickup-energy', 'job.refill-spawns', 'job.refill-extensions', 'job.refill-tower',
    'job.harvest', 'job.harvest-mineral', 'job.empty-containers', 'job.controller-link',
].forEach(modName => {
    let mod = require(modName);
    jobModules[mod.JOB_TYPE] = mod.getHandler();
});

class JobBoard extends utils.Executable {
    constructor() {
        super();

        this.updateTimer = new utils.Timer();

        if(!Memory.jobBoard) {
            Memory.jobBoard = {};
        }

        this.generatedJobs = {};
    }

    get memory() {
        return Memory.jobBoard;
    }

    /**
     *
     * @param {Object} options
     * @param {Object} options.type
     * @param {CreepMindBase} options.mind
     * @param {Room} options.room
     * @param {Object} options.minAmount
     * @param {Object} options.filter
     * @return {Array}
     */
    find(options) {
        if(!options.minAmount) {
            options.minAmount = 1;
        }

        if(options.mind) {
            options.mind = options.mind.constructor.name;
        }

        if(options.room) {
            options.room = options.room.name;
        }

        // console.log('INCOMING SEARCH', JSON.stringify(options));

        return _.sortByOrder(_.filter(this.memory, jobData => {
            if(jobData.deleted) {
                return false;
            }

            // console.log('Searching 1: ', jobData.id, options.room.name, jobData.room)
            if(options.room && options.room != jobData.room) {
                return false;
            }

            if(options.mind && options.mind != jobData.mind) {
                return false;
            }

            if(options.type && options.type != jobData.type) {
                return false;
            }

            // console.log('Searching: ', jobData.id, jobData.available - _.sum(jobData.claims), options.minAmount);
            if(jobData.available - _.sum(jobData.claims) < options.minAmount) {
                return false;
            }

            if(options.filter && !options.filter(jobData)) {
                return false;
            }

            return true;
        }), ['available'], ['desc']);
    }

    claim(creep, jobData, claimAmount) {
        claimAmount = claimAmount || 1;

        if(creep.memory.jobId && creep.memory.jobId == jobData.id) {
            console.log('OMG CREEP ALREADY HAS JOB', creep, '::', creep.memory.jobId, '::', jobData.id);
            return false;
        }

        if(creep.memory.jobId == jobData.id) {
            console.log('[JOB BOARD] ',creep,' already has job:', jobData.id);
            return true;
        }

        let claimed = _.sum(jobData.claims);

        if(claimed < jobData.available) {
            creep.memory.jobId = jobData.id;
            jobData.claims[creep.name] = claimAmount;
            if(jobData.takenBy)
                jobData.takenBy[creep.name] = true;

            creep.memory.jobStateData = {};
            creep.memory.jobState = null;

            return true;
            // return new jobModules[jobData.type](creep, jobData);
        }

        return false;
    }

    getJobHandler(creep) {
        let jobData = this.memory[creep.memory.jobId];
        if(!jobData) {
            console.log('creep', creep, 'has invalid job!!', creep.memory.jobId);
            delete creep.memory.jobId;
            return;
        }

        return new jobModules[jobData.type](creep, jobData);
    }

    /**
     * @param {RoomManager} manager
     */
    update(manager) {
        this.updateTimer.start();

        _.each(jobModules, mod => {
            let jobs = mod.generateJobs(manager) || [];

            jobs.forEach(job => {
                this.generatedJobs[job.id] = job.id;

                let jobData = this.memory[job.id];

                if(jobData) {
                    job.merge(jobData);
                }
                else {
                    job.room = manager.room.name;
                    if(!job.available) {
                        job.available = 1;
                    }
                    job.claims = {};

                    this.memory[job.id] = job;
                }
            });

        });

        this.updateTimer.stop();
    }

    handleDeadCreep(name, memo) {
        if(memo.jobId) {
            this.info('Cleaned claim for dead creep', name, '::', memo.jobId);

            delete this.memory[memo.jobId].claims[name];
            delete this.memory[memo.jobId].takenBy[name];
        }
    }

    cleanup() {
        this.updateTimer.start();

        let toDelete = [];

        _.each(this.memory, jobData => {
            if(!this.generatedJobs[jobData.id]) {

                if(_.size(jobData.takenBy) > 0) {
                    jobData.deleted = true;
                    return;
                }

                toDelete.push(jobData.id);
            }
            else {
                if(jobData.deleted && _.size(jobData.takenBy) == 0) {
                    toDelete.push(jobData.id);
                }
            }
        });

        if(toDelete.length > 0) {
            toDelete.forEach(jobId => {
                delete this.memory[jobId];
            });
            // console.log('Deleted', toDelete.length, 'jobs:', toDelete);
        }

        this.updateTimer.stop();
    }

    toString() {
        return '[JobBoard]';
    }
}

module.exports = {
    JobBoard,
};