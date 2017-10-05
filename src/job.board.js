const _ = require('lodash');

// const minds = require('mind');
const jobModules = {};

['job.pickup-energy', 'job.refill-spawns', 'job.refill-extensions'].forEach(modName => {
    let mod = require(modName);
    jobModules[mod.JOB_TYPE] = mod.getHandler();
});

const jobTypes = {
    JOB_SPAWN: require('job.refill-spawns').JOB_TYPE,
    JOB_EXTENSIONS: require('job.refill-extensions').JOB_TYPE,
};

class JobBoard {
    constructor() {
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
     * @param {Object} options.mind
     * @param {Object} options.room
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

        return _.filter(this.memory, jobData => {


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

            let job = jobModules[jobData.type].deserializeJob(jobData);

            if(options.filter && !options.filter(job)) {
                return false;
            }

            return true;
        }).map(jobData => {
            // console.log('searching returns', jobData.id, '::');
            return jobModules[jobData.type].deserializeJob(jobData);
        });
    }

    claim(creep, jobData, claimAmount) {
        claimAmount = claimAmount || 1;

        if(creep.memory.jobId == jobData.id) {
            console.log('[JOB BOARD] ',this.creep,'Returning existing job', jobData.id);

            // return new jobModules[jobData.type](creep, jobData);
        }

        let claimed = _.sum(jobData.claims);

        console.log('creep', creep, 'will try to claim', jobData.id, '::', claimed, '::', claimAmount, jobData.available);

        if(claimed + claimAmount <= jobData.available) {
            creep.memory.jobId = jobData.id;
            jobData.claims[creep.id] = claimAmount;

            console.log('[JOB BOARD] ',creep,'Claimed new job', jobData.id, '::', jobData.type);
            // return new jobModules[jobData.type](creep, jobData);
        }

        throw creep + " : Unable to claim job " + jobData.id
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

        _.each(jobModules, mod => {
            let jobs = mod.generateJobs(manager);

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
    }

    handleDeadCreep(creepData) {

    }

    cleanup() {
        let toDelete = [];

        _.each(this.memory, jobData => {
            if(!this.generatedJobs[jobData.id]) {
                toDelete.push(jobData.id);
            }
        });

        if(toDelete.length > 0) {
            toDelete.forEach(jobId => {
                delete this.memory[jobId];
            });
            // console.log('Deleted', toDelete.length, 'jobs:', toDelete);
        }
    }
}

module.exports = {
    JobBoard,
    jobTypes
};