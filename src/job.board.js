const _ = require('lodash');

const minds = require('mind');
const jobModules = {};

['job.pickup-energy', 'job.refill-extensions'].forEach(modName => {
    let mod = require(modName);
    jobModules[mod.JOB_TYPE] = mod.getHandler();
});

class JobBoard {
    constructor(manager) {
        this.roomMgr = manager;
        this.room = manager.room;

        if(!this.room.memory.jobBoard) {
            this.room.memory.jobBoard = {};
        }

        _.each(minds.available, mind => {
            if(!this.memory[mind.name]) {
                this.memory[mind.name] = {};
            }
        });
    }

    get memory() {
        return this.room.memory.jobBoard
    }

    find(mind, filter) {
        return _.filter(this.memory[mind.name], jobData => {
            let job = jobModules[jobData.type].deserializeJob(jobData);

            return filter(job);
        })
    }

    update() {
        let toDelete = {};
        _.each(this.memory, mindJobs => {
            _.each(mindJobs, jobData => {
                toDelete[jobData.id] = jobData;
            });
        });

        _.each(jobModules, (mod, modType) => {
            let jobs = mod.generateJobs(this.roomMgr);

            jobs.forEach(job => {
                delete toDelete[job.id];

                let jobData = this.getJobData(job);

                if(jobData) {
                    job.merge(jobData);
                }
                else {
                    this.addJob(job);
                }
            });

        });

        if(_.size(toDelete) > 0) {
            _.each(toDelete, jobData => {
                delete this.memory[jobData.mind][jobData.id];
            });

            console.log('Deleted', _.size(toDelete), 'jobs');
        }
    }

    /**
     *
     * @param {JobDTO} job
     */
    getJobData(job) {
        return this.memory[job.mind][job.id];
    }

    addJob(job) {
        this.memory[job.mind][job.id] = job;
    }
}

module.exports = {
    JobBoard
};