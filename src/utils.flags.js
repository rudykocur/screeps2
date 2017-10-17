
module.exports = {

    /**
     * @param {Flag} flag
     */
    isBlock(flag) {},

    isMeetingPoint() {},

    /**
     * @param {Flag} flag
     */
    isExtensionCluster(flag) {
        return flag.color === COLOR_YELLOW && flag.secondaryColor === COLOR_YELLOW;
    },

    /**
     * @param {Flag} flag
     */
    isTower(flag) {
        return flag.color === COLOR_RED && flag.secondaryColor === COLOR_YELLOW;
    },

    /**
     * @param {Flag} flag
     */
    isClaim(flag) {
        return flag.color === COLOR_RED && flag.secondaryColor === COLOR_WHITE;
    },

    /**
     * @param {Flag} flag
     */
    isRoomAttack(flag) {
        return flag.color === COLOR_RED && flag.secondaryColor === COLOR_GREY;
    }
};