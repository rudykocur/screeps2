const RoomManager = require("rooms").RoomManager;
const minds = require('mind');

module.exports.loop = function () {
    for(let name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }

    let rooms = [];
    for(let i in Game.rooms) {
        let mgr = new RoomManager(Game.rooms[i]);
        mgr.update();
        rooms.push(mgr);
    }

    rooms.forEach((manager) => {
        manager.minds.forEach((mind) => {
            try{
                mind.update();
            }
            catch(e) {
                console.log('MIND FAILED:', e, 'Stack trace:', e.stack);
            }
        })
    });

};