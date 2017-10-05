

class JobHandlerBase {
    constructor(creep, jobData) {
        this.creep = creep;
        this.data = jobData;
    }
}

class JobDTO {
    constructor(id, type, mind, available, claims) {
        this.id = id;
        this.type = type;
        this.mind = mind.name;

        this.available = available;
        this.claims = claims;
    }

    merge(data) {

    }
}

module.exports = {
    JobDTO, JobHandlerBase
};