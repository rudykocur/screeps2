var _ = require('lodash');

class ThreatAssesment {
    constructor(enemies) {
        this.enemies = enemies;
        this.combatCreeps = _.filter(this.enemies, c => c.getActiveBodyparts(ATTACK)
            || c.getActiveBodyparts(RANGED_ATTACK) || c.getActiveBodyparts(HEAL));

        this.rangedCreeps = this.combatCreeps.filter(c => c.getActiveBodyparts(RANGED_ATTACK));
    }

    rangedPower() {
        return _.sum(this.rangedCreeps, creep => creep.getActiveBodyparts(RANGED_ATTACK));
    }

    getCombatCreeps() {
        return this.combatCreeps;
    }

    getClosestEnemy(attacker) {
        let targets = this.combatCreeps;
        if(targets.length === 0) {
            targets = this.enemies;
        }

        return attacker.pos.findClosestByRange(targets);
    }
}

module.exports = {
    ThreatAssesment
};