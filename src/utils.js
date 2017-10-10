

module.exports = {
    throttle(ticks, callback) {
        return () => {
            if (Game.time % ticks == 0) {
                callback();
            }
        }

    },

    /**
     * @param {Flag} flag
     */
    isBlockFlag(flag) {
        return flag.color == COLOR_RED && flag.secondaryColor == COLOR_RED;
    },

    isMeetingPointFlag() {

    },

    isExtensionClusterFlag() {

    }
};