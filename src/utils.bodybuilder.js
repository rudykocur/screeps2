var _ = require('lodash');

module.exports = {
    build(pattern, budget, prefix, suffix) {
        prefix = prefix || [];
        suffix = suffix || [];

        let baseCost = _.sum(prefix.concat(suffix), part => BODYPART_COST[part]);
        let patternCost = _.sum(pattern, part => BODYPART_COST[part]);

        if(baseCost + patternCost > budget) {
            return prefix.concat(suffix);
        }

        let spentBudget = baseCost;

        let result = [];
        let len = prefix.length + suffix.length + pattern.length;

        do {
            result = result.concat(pattern);
            spentBudget += patternCost;
        } while(spentBudget + patternCost <= budget && result.length + len < MAX_CREEP_SIZE);

        return prefix.concat(result, suffix);
    }
};