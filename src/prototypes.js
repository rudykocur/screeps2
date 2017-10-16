const mover = require('move-controller');

module.exports = {
    installPrototypes() {

        if(!Room.prototype.hasOwnProperty('energyMissing')) {
            Object.defineProperty(Room.prototype, "energyMissing", {
                get: function () {
                    return this.energyCapacityAvailable - this.energyAvailable;
                }
            });
        }

        if(!Creep.prototype.hasOwnProperty('workRoom')) {
            Object.defineProperty(Creep.prototype, "workRoom", {
                get: function () {
                    let workRoom = Game.rooms[this.memory.roomName];
                    if (workRoom) {
                        return workRoom.manager;
                    }
                }
            });
        }
        if(!Creep.prototype.hasOwnProperty('mover')) {
            Object.defineProperty(Creep.prototype, "mover", {
                get: function () {
                    if (!this._mover) {
                        this._mover = new mover.CreepMoveController(this);
                    }

                    return this._mover;
                }
            });
        }

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