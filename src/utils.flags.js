
module.exports = {

    /**
     * @param {Flag} flag
     */
    isStorage(flag) {
        return flag.color === COLOR_BLUE && flag.secondaryColor === COLOR_BLUE;
    },

    /**
     * @param {Flag} flag
     */
    isMeetingPoint(flag) {
        return flag.color === COLOR_GREEN && flag.secondaryColor === COLOR_GREEN;
    },

    /**
     * @param {Flag} flag
     */
    isExtensionCluster(flag) {
        return flag.color === COLOR_YELLOW && flag.secondaryColor === COLOR_YELLOW;
    },

    /**
     * @param {Flag} flag
     */
    isLink(flag) {
        return flag.color === COLOR_YELLOW && flag.secondaryColor === COLOR_BROWN;
    },

    /**
     * @param {Flag} flag
     */
    isTower(flag) {
        return flag.color === COLOR_YELLOW && flag.secondaryColor === COLOR_RED;
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
    isSpawn(flag) {
        return flag.color === COLOR_YELLOW && flag.secondaryColor === COLOR_PURPLE;
    },

    /**
     * @param {Flag} flag
     */
    isInputLab(flag) {
        return flag.color === COLOR_WHITE && flag.secondaryColor === COLOR_BLUE;
    },

    /**
     * @param {Flag} flag
     */
    isRoomAttack(flag) {
        return flag.color === COLOR_RED && flag.secondaryColor === COLOR_GREY;
    }
};