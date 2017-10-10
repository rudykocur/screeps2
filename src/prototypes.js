module.exports = {
    installPrototypes() {
        Object.defineProperty(Room.prototype, "energyMissing", {
            get: function() {
                return this.energyCapacityAvailable - this.energyAvailable;
            }
        });

        Object.defineProperty(Creep.prototype, "workRoom", {
            get: function() {
                let workRoom = Game.rooms[this.memory.roomName];
                if(workRoom) {
                    return workRoom.manager;
                }
            }
        })
    }
};