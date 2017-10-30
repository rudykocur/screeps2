var _ = require('lodash');
const utils = require('utils');

const profiler = require('profiler');

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

        if(this.terminal.cooldown > 0) {
            return;
        }

        utils.everyMod(1, this.terminal.id, this.buyBaseMinerals.bind(this));
    }

    buyBaseMinerals() {
        let toBuy = this.getResourcesToBuy();

        if(_.size(toBuy) === 0) {
            return;
        }

        if(this.terminal.store[RESOURCE_ENERGY] < 15000) {
            return;
        }

        let orders = this.getMarketOrders(toBuy);

        _.each(toBuy, (maxPrice, resource) => {

            let order = this.findBuyOrder(orders, resource);

            if(!order) {
                return;
            }

            let toBuy = Math.max(1000, this.resourcesMinimum - (this.terminal.store[resource] || 0));
            toBuy = Math.min(toBuy, order.remainingAmount);

            let result = Game.market.deal(order.id, toBuy, this.manager.roomName);

            if(result === OK) {
                this.important(`Bought ${toBuy} of ${resource} for ${order.price}. Energy cost: ${order.energyCost}`);
            }
        });
    }

    findBuyOrder(orders, resource) {
        for(let order of orders) {
            if(order.resourceType !== resource) {
                continue;
            }

            return order;
        }
    }

    getMarketOrders(maxPrices) {
        let orders = Game.market.getAllOrders({type: ORDER_SELL});
        orders.forEach(order => {
            if(!order.roomName) {
                return;
            }

            order.distance = Game.map.getRoomLinearDistance(this.manager.roomName, order.roomName, true);
            order.energyCost = Game.market.calcTransactionCost(
                order.remainingAmount, this.manager.roomName, order.roomName)
        });
        orders = orders.filter(o => {
            if(!o.energyCost || o.energyCost > 15000) {
                return false;
            }

            if(o.distance > 60) {
                return false;
            }

            return o.price < maxPrices[o.resourceType];
        });

        orders = _.sortBy(orders, 'price');

        return orders;
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

profiler.registerClass(RoomMarket, RoomMarket.name);

module.exports = {
    RoomMarket
};