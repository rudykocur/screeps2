var _ = require("lodash");
let flags = require('utils.flags');

const roomTypes = {
    regular: require('room.regular').RoomManager,
    settlement: require('room.settlement').RoomSettlement,
    siege: require('room.siege').RoomSiege,
};

function safeCtor(callback, room) {
    try {
        callback();
    }
    catch(e) {
        console.log('Constructor failed:', room, '::', e, '.Stack trace:', e.stack);
        Game.notify(`Constructor failed: ${e}. Stack trace: ${e.stack}`, 5);
    }
}


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

            safeCtor(() => managers.push(new roomTypes.regular(room, jobBoard)), room);
        });

        let result = [].concat(managers);

        for(let flag of _.filter(Game.flags, flags.isRoomAttack)) {
            safeCtor(() => result.push(new roomTypes.siege(flag.pos.roomName, flag, managers)));
        }

        for(let flag of _.filter(Game.flags, flags.isClaim)) {
            safeCtor(() => result.push(new roomTypes.settlement(flag.pos.roomName, flag, managers)));
        }

        return result;
    }
};