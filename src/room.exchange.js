var _ = require('lodash');

const utils = require('utils');

class InterRoomExchange extends utils.Executable {
    constructor(managers) {
        super();

        this.managers = managers.filter(mgr => mgr.terminal && mgr.market);

        this.exports = [];
        this.total = [];
    }

    run() {
        this.total = this.getTotalResources();
        this.exports = this.getExportedResources();
    }

    getTotal(resource) {
        return (this.total[resource] || 0);
    }

    /**
     *
     * @param {RoomManager} target
     * @param resource
     * @param amount
     */
    requestResources(target, resource, amount) {
        let exports = this.exports.filter(e => {
            if(e.resource !== resource) return false;
            if(e.amount <= 300) return false;
            if(e.manager.terminal.cooldown > 0) return false;
            return true;
        });

        let remaining = amount;

        for(let available of exports) {
            let toTransfer = Math.min(remaining, available.amount);
            let status = available.manager.terminal.send(available.resource, toTransfer, target.roomName);

            if(status === OK) {
                remaining -= toTransfer;
                available.amount -= toTransfer;
                this.info(`Transferred ${toTransfer}x ${available.resource} from ` +
                            `${available.manager.roomName} to ${target.roomName}`);
            }
            else {
                this.warn(`Unable to send ${toTransfer}x ${available.resource} from ` +
                            `${available.manager.roomName} to ${target.roomName} - ${status}`);
            }

            if(remaining <= 0) {
                return;
            }
        }
    }

    getExportedResources() {
        let result = [];
        for(let mgr of this.managers) {
            let exported = mgr.market.getExportedResources();

            _.each(exported, (amount, res) => {
                result.push({resource: res, amount: amount, manager: mgr});
            })
        }

        return _.sortBy(result, row => row.amount * -1);
    }

    getTotalResources() {
        let result = {};

        for(let mgr of this.managers) {
            result = _.merge(result, mgr.market.getResourcesTotal(), (a, b) => (a||0)+b);
        }

        return result;
    }

    toString() {
        return `[InterRoomExchange]`;
    }
}


module.exports = {
    InterRoomExchange
};