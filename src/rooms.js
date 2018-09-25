var _ = require("lodash");
let flags = require('utils.flags');
const naming = require('utils.naming');

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

/**
 * @param {Array<RoomManager>} managers
 */
function setRoomsNames(managers) {

    let usedNamingGroups = managers.map(mgr => mgr.namingGroup).filter(x => x);

    for(let mgr of managers) {
        if(!mgr.name) {
            naming.pickGroup(usedNamingGroups);

            let group = naming.pickGroup(usedNamingGroups);

            mgr.setNamingGroup(group);
            usedNamingGroups.push(group);

            mgr.setRoomName(naming.pickLocationName(group, [], true));
        }

        let usedNames = mgr.remote.handlers.map(h => h.name).filter(x => x);
        usedNames.push(mgr.name);

        for(let remote of mgr.remote.handlers) {
            if(!remote.name) {
                let remoteRoomName = naming.pickLocationName(mgr.namingGroup, usedNames, false);
                remote.setRoomName(remoteRoomName);
                usedNames.push(remoteRoomName);
            }
        }
    }
}


module.exports = {
    getHandlers(jobBoard, procMgr) {
        let managers = [];
        _.each(Game.rooms, room => {
            if(!room.controller || !room.controller.my) {
                return;
            }

            if(room.find(FIND_STRUCTURES).filter(s => s.structureType == STRUCTURE_SPAWN).length === 0) {
                return;
            }

            safeCtor(() => managers.push(new roomTypes.regular(room, jobBoard, procMgr)), room);
        });

        setRoomsNames(managers);

        let result = [];

        for(let flag of _.filter(Game.flags, flags.isRoomAttack)) {
            safeCtor(() => result.push(new roomTypes.siege(flag.pos.roomName, flag, managers)));
        }

        result = result.concat(managers);

        for(let flag of _.filter(Game.flags, flags.isClaim)) {
            safeCtor(() => result.push(new roomTypes.settlement(flag.pos.roomName, flag, managers)));
        }

        return result;
    }
};