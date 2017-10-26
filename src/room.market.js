var _ = require('lodash');
const utils = require('utils');

class RoomMarket extends utils.Executable {
    /**
     *
     * @param {RoomManager} manager
     * @param {StructureTerminal} terminal
     */
    constructor(manager, terminal) {
        super();

        this.manager = manager;
        this.terminal = terminal;

        this.resourcesMinimum = 20000;
    }

    update() {
        if(!this.terminal) {
            return;
        }

        utils.everyMod(1, this.terminal.id, this.buyBaseMinerals.bind(this));
    }

    buyBaseMinerals() {
        let toBuy = this.getResourcesToBuy();

        if(_.size(toBuy) === 0) {
            return;
        }

        let orders = Game.market.getAllOrders();
        orders.forEach(order => {
            order.distance = Game.map.getRoomLinearDistance(this.manager.roomName, order.roomName, true);
        });
        orders = _.sortBy(orders, 'distance');

        _.each(toBuy, (maxPrice, resource) => {
            // _.first(orders.filter)
        });
    }

    getResourcesToBuy() {
        let base = _.without(RESOURCES_BASE, [RESOURCE_CATALYST, RESOURCE_ENERGY]);

        let result = {};
        for(let resource of base) {
            let maxPrice = _.get(Memory, ['market','buy', resource]);

            let have = this.terminal.store[resource] || 0;

            if(have < this.resourcesMinimum && maxPrice) {
                result[resource] = maxPrice;
            }
        }

        return result;
    }

    toString() {
        return `[RoomMarket for ${this.manager.roomName}]`;
    }
}

module.exports = {
    RoomMarket
};