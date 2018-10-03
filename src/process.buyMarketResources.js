var _ = require('lodash');

const procbase = require('process.base');
const procmgr = require('process.manager');

const utils = require('utils');


class BuyMarketResources extends procbase.ProcessBase {

    /**
     * @param {RoomManager} manager
     * @param toBuy
     */
    static factory(manager, toBuy) {
        return new BuyMarketResources('buy-market-resoures-' + manager.getRoomTitle(), {
            roomName: manager.room.name,
            toBuy: toBuy,
        })
    }

    constructor(processId, state) {
        super(processId, state);

        let roomName = this.state.roomName;
        /**
         * @type {Room}
         */
        let room = Game.rooms[roomName];
        this.manager = room.manager;
        this.resourcesMinimum = 8000;

        this.terminal = this.manager.terminal;
        this.storage = this.manager.room.storage;
    }

    *run() {

        let toBuy = this.state.toBuy;

        let orders = this.getMarketOrders(toBuy);

        let bought = false;

        _.each(toBuy, (maxPrice, resource) => {

            if(bought) {
                return;
            }

            let order = this.findBuyOrder(orders, resource);

            if(!order) {
                return;
            }

            let toBuy = Math.max(1000, this.resourcesMinimum - (this.terminal.store[resource] || 0));
            toBuy = Math.min(toBuy, order.remainingAmount);

            let result = Game.market.deal(order.id, toBuy, this.manager.roomName);

            if(result === OK) {
                this.important(`Bought ${toBuy} of ${resource} for ${order.price}. Energy cost: ${order.energyCost}`);
                bought = true;
            }
        });
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

        orders = _.sortBy(orders, ['price', 'remainingAmount']);

        return orders;
    }

    findBuyOrder(orders, resource) {
        for(let order of orders) {
            if(order.resourceType !== resource) {
                continue;
            }

            return order;
        }
    }

    toString() {
        return `[BuyMarketResources for ${this.manager.getRoomTitle()}]`;
    }
}

procmgr.registerProcessType(BuyMarketResources);

module.exports = {
    BuyMarketResources
};