var _ = require('lodash');
const utils = require('utils');

const profiler = require('profiler');

class RoomMarket extends utils.Executable {
    /**
     *
     * @param {RoomManager} manager
     * @param {StructureTerminal} terminal
     * @param {StructureStorage} storage
     * @param {LabManager} labMgr
     */
    constructor(manager, terminal, storage, labMgr) {
        super();

        this.manager = manager;
        this.terminal = terminal;
        this.storage = storage;
        this.labMgr = labMgr;

        this.resourcesMinimum = 8000;
        this.resourcesThreshold = 2000;

        this.terminalLimit = this.resourcesMinimum + this.resourcesThreshold;
    }

    /**
     * @param {InterRoomExchange} exchange
     */
    update(exchange) {
        if(!this.terminal) {
            return;
        }

        if(this.terminal.cooldown > 0) {
            return;
        }

        this.importResources(exchange);
        utils.everyMod(100, this.terminal.id, this.buyBaseMinerals.bind(this));
    }

    /**
     * @param {InterRoomExchange} exchange
     */
    importResources(exchange) {
        let wanted = this.getWantedResources();

        _.each(wanted, (amount, resource) => {
            exchange.requestResources(this.manager, resource, amount);
        });
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

    getResourcesTotal() {
        let result = {};

        for(let resource of _.without(RESOURCES_ALL, RESOURCE_ENERGY)) {
            result[resource] = 0;
            for(let struct of [this.terminal, this.storage]) {
                result[resource] += struct.get(resource);
            }
        }

        for(let lab of this.labMgr.labs) {
            if(lab.mineralType) {
                result[lab.mineralType] += lab.mineralAmount;
            }
        }

        return result;
    }

    getExportedResources() {
        let result = {};

        for(let resource of RESOURCES_ALL) {
            if(RESOURCES_BASE.indexOf(resource) >= 0) {
                if(this.terminal.get(resource) > this.terminalLimit) {
                    result[resource] = this.terminal.get(resource) - this.terminalLimit;
                }
            }
            else if(this.terminal.get(resource) > 1000) {
                result[resource] = this.terminal.get(resource);
            }
        }

        return result;
    }

    getWantedResources() {
        if(this.labMgr.labs === 0) {
            return {};
        }

        let base = _.without(RESOURCES_BASE, [RESOURCE_ENERGY]);
        if(this.labMgr.labs.length <= 3){
            base = _.without(base, [RESOURCE_CATALYST]);
        }
        
        let have = this.getResourcesTotal();

        let result = {};
        for(let resource of base) {

            if(have[resource] < this.resourcesMinimum) {
                result[resource] = this.resourcesMinimum - have[resource] + this.resourcesThreshold;
            }
        }

        let boosts = this.labMgr.getActiveBoosts();

        for(let boostResource of boosts) {
            if(have[boostResource] < 3000) {
                result[boostResource] = 3000 - have[boostResource];
            }
        }

        return result;
    }

    getResourcesToBuy() {
        let wanted = this.getWantedResources();

        let result = {};
        for(let resource of _.keys(wanted)) {
            let maxPrice = _.get(Memory, ['market','buy', resource]);

            if(maxPrice) {
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