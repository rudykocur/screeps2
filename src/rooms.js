var _ = require("lodash");
let flags = require('utils.flags');

const roomTypes = {
    regular: require('room.regular').RoomManager,
    settlement: require('room.settlement').RoomSettlement,
};


module.exports = {
    getHandlers(jobBoard) {
        let managers = [];
        _.each(Game.rooms, room => {
            if(!room.controller || !room.controller.my) {
                return;
            }

            if(room.find(FIND_STRUCTURES).filter(s => s.structureType == STRUCTURE_SPAWN).length === 0) {
                return;
            }

            managers.push(new roomTypes.regular(room, jobBoard));
        });

        let result = [].concat(managers);

        for(let flag of _.filter(Game.flags, flags.isClaim)) {
            result.push(new roomTypes.settlement(flag.pos.roomName, flag, managers));
        }

        return result;
    }
};