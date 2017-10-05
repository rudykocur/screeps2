

class JobDTO {
    constructor(id, type, mind) {
        this.id = id;
        this.type = type;
        this.mind = mind.name;
    }

    merge(data) {

    }
}

module.exports = {
    JobDTO
};