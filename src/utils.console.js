var _ = require('lodash');
const regularRoom = require('room.regular');
const utils = require('utils')

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

function showRooms() {
    console.log('Room handlers:');

    _(Game.rooms)
        .map(room => room.manager)
        .filter(mgr => (mgr instanceof regularRoom.RoomManager))
        .sortBy(mgr => mgr.getRoomTitle())
        .forEach(/**RoomManager*/mgr => {

            let remotes = _(mgr.remote.handlers)
                .sortBy(remote => remote.getRoomTitle())
                .map(remote => utils.getRoomLink(remote.roomName, remote.getRoomTitle()));

            console.log('Room:', utils.getRoomLink(mgr.roomName, mgr.getRoomTitle()), 'remotes:', remotes);
        }).value()
}

showRooms.description = 'Print all rooms with remotes';
showRooms.signature = 'showRooms()';

let commands = [help, setBuyPrice, setSellPrice, setSiegeCreep, showRooms];

module.exports = {
    installConsoleFunctions(target) {
        commands.forEach(command => {
            target[command.name] = command;
        })
    }
};