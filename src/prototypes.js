module.exports = {
    installPrototypes() {

        if(!Object.hasOwnProperty('energyMissing'))
        Object.defineProperty(Room.prototype, "energyMissing", {
            get: function() {
                return this.energyCapacityAvailable - this.energyAvailable;
            }
        });

        if(!Object.hasOwnProperty('workRoom'))
            Object.defineProperty(Creep.prototype, "workRoom", {
                get: function() {
                    let workRoom = Game.rooms[this.memory.roomName];
                    if(workRoom) {
                        return workRoom.manager;
                    }
                }
            });

        if(!('RESOURCES_BASE' in global)) {
            global.RESOURCES_BASE = [
                RESOURCE_UTRIUM,
                RESOURCE_KEANIUM,
                RESOURCE_ZYNTHIUM,
                RESOURCE_LEMERGIUM,
                RESOURCE_OXYGEN,
                RESOURCE_HYDROGEN,
                RESOURCE_CATALYST,
                RESOURCE_ENERGY
            ];
        }
    }
};