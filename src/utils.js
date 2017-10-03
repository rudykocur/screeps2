

module.exports = {
    throttle(ticks, callback) {
        if(Game.time % ticks == 0) {
            callback();
        }
    }
};