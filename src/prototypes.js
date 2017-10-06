module.exports = {
    installPrototypes() {
        Object.defineProperty(Room.prototype, "energyMissing", {
            get: function() {
                return this.energyCapacityAvailable - this.energyAvailable;
            }
        })
    }
};