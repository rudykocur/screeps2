

class MissionBase {
    static get TYPE() {};
}

class DefendRoomMission extends MissionBase {
    static get TYPE() {return 'defend-room'};

    constructor(squad) {
        super();
    }

    /**
     * @param {CombatSquad} squad
     * @param manager
     */
    static createMission(squad, manager) {
        squad.memory.missionData = {
            roomName: manager.room.name
        }
    }
}

module.exports = {
    missions: {
        [DefendRoomMission.TYPE]: DefendRoomMission
    },
    DefendRoomMission,
};