var _ = require('lodash');

function help() {
    console.log(`Available commands:`);

    commands.forEach(c => {
        console.log(`    ${c.signature} - ${c.description}`);
    })
}
help.description = 'This help text';
help.signature = 'help()';

function setBuyPrice(resource, maxPrice) {
    _.defaultsDeep(Memory, {market: {buy: {}}});

    Memory.market.buy[resource] = maxPrice;

    console.log(`Maximum buy price for ${resource} set to ${maxPrice}`);
}
setBuyPrice.description = 'Sets maximum buy price';
setBuyPrice.signature = 'setBuyPrice(resource, maxPrice)';

function setSellPrice(resource, minPrice) {
    _.defaultsDeep(Memory, {market: {sell: {}}});

    Memory.market.sell[resource] = minPrice;

    console.log(`Minimum sell price for ${resource} set to ${minPrice}`);
}

setSellPrice.description = 'Sets minimum sell price.';
setSellPrice.signature = 'setSellPrice(resource, minPrice)';

function setSiegeCreep(body, boosts) {
    Memory.siegeCreep = {
        body, boosts
    };

    console.log(`Set blueprint for siege creep.`);
}
setSiegeCreep.description = 'Sets blueprint for siege creep.';
setSiegeCreep.signature = 'setSiegeCreep(body, boosts)';

let commands = [help, setBuyPrice, setSellPrice, setSiegeCreep];

module.exports = {
    installConsoleFunctions(target) {
        commands.forEach(command => {
            target[command.name] = command;
        })
    }
};