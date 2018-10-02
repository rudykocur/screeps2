var _ = require('lodash');
const mover = require('move-controller');

/**
 * @typedef {Creep} Creep
 * @property {Number} carryTotal Creep current carry
 * @property {CreepMoveController} mover
 * @property {CreepMindBase} mind
 */

/**
 * @typedef {Room} Room
 * @property {RoomManager} manager
 */

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

        if(!Creep.prototype.hasOwnProperty('carryMax')) {
            Object.defineProperty(Creep.prototype, "carryMax", {
                get: function () {
                    return _.sum(this.carry) == this.carryCapacity;
                }
            });
        }

        if(!Creep.prototype.hasOwnProperty('carryTotal')) {
            Object.defineProperty(Creep.prototype, "carryTotal", {
                get: function () {
                    return _.sum(this.carry);
                }
            });
        }

        if(!Creep.prototype.hasOwnProperty('enterRoom')) {
            Creep.prototype.enterRoom = function() {
                if(this.pos.x === 0) {
                    this.move(RIGHT);
                }
                if(this.pos.y === 0) {
                    this.move(BOTTOM);
                }
                if(this.pos.x === 49) {
                    this.move(LEFT);
                }
                if(this.pos.y === 49) {
                    this.move(TOP);
                }
            }
        }

        if(!StructureStorage.prototype.hasOwnProperty('get')) {
            StructureStorage.prototype.get = function(resource, defaultValue) {
                return this.store[resource] || defaultValue || 0;
            }
        }

        if(!StructureTerminal.prototype.hasOwnProperty('get')) {
            StructureTerminal.prototype.get = function(resource, defaultValue) {
                return this.store[resource] || defaultValue || 0;
            }
        }

        if(!RoomPosition.prototype.hasOwnProperty('serialize')) {
            RoomPosition.prototype.serialize = function() {
                return this.x+','+this.y+','+this.roomName;
            }
        }

        if(!RoomPosition.prototype.hasOwnProperty('isEdge')) {
            RoomPosition.prototype.isEdge = function() {
                return this.x === 49 || this.y === 49 || this.x === 0 || this.y === 0;
            }
        }

        if(!RoomPosition.prototype.hasOwnProperty('findStructuresInRange')) {
            RoomPosition.prototype.findStructuresInRange = function(structType, range) {
                return this.findInRange(FIND_STRUCTURES, range, {
                    filter: s => s.structureType === structType
                });
            }
        }

        if(!RoomPosition.prototype.hasOwnProperty('findConstructionsInRange')) {
            RoomPosition.prototype.findConstructionsInRange = function(structType, range) {
                return this.findInRange(FIND_CONSTRUCTION_SITES, range, {
                    filter: /**ConstructionSite*/c => c.structureType === structType
                });
            }
        }

        if(!RoomPosition.unserialize) {
            /**
             * @param posStr
             * @return {RoomPosition}
             */
            RoomPosition.unserialize = function(posStr) {
                let parts = posStr.split(',');
                // let obj = {x: parts[0], y: parts[1], roomName: parts[2]};
                // obj.__proto__ = RoomPosition.prototype;
                // return obj;
                return new RoomPosition(parts[0], parts[1], parts[2]);
            }
        }

        if(!RoomPosition.asPosition) {
            RoomPosition.asPosition = function(obj, roomName) {
                return new RoomPosition(obj.x, obj.y, roomName || obj.roomName);
            }
        }

        if(!Room.Terrain.prototype.isWalkable) {
            Room.Terrain.prototype.isWalkable = function(x, y) {
                return this.get(x, y) === TERRAIN_MASK_SWAMP || this.get(x, y) === TERRAIN_MASK_PLAIN;
            }
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

        if(!('TERRAIN_MASK_PLAIN' in global)) {
            global.TERRAIN_MASK_PLAIN = 0;
        }
    }
};