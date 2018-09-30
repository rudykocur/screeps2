var _ = require("lodash");

const utils = require('utils');
const proto = require('prototypes');

const game = require('game-manager');

proto.installPrototypes();

if(!('REACTIONS_REVERSE' in global)) {
    global.REACTIONS_REVERSE = utils.reverseReactions(REACTIONS);
}

global.PROFILER_ENABLED = true;
// global.PROFILER_ENABLED = false;

const profiler = require('profiler.screeps');
profiler.enable();

module.exports = {
    loop: function() {
        let mgr = new game.GameManager();

        if(profiler.isEnabled()) {
            profiler.wrap(mgr.run.bind(mgr));
        }
        else {
            mgr.run();
        }
    }
};