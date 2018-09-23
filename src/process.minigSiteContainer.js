var _ = require('lodash');

const procbase = require('process.base');
const procmgr = require('process.manager');

const utils = require('utils');

class MiningSiteContainer extends procbase.ProcessBase {

    /**
     * @param {MiningSite} site
     */
    static factory(site) {
        return new MiningSiteContainer('mining-site-container-' + site.source.id, {
            siteId: site.source.id,
            roomName: site.source.pos.roomName,
        })
    }

    *run() {
        let room = Game.rooms[this.state.roomName];
        let /**MiningSite*/ site = room.manager.mines[this.state.siteId];

        let containerInProgress = _.first(site.source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
            filter: /**ConstructionSite*/construction => construction.structureType === STRUCTURE_CONTAINER
        }));

        if(containerInProgress) {
            return;
        }

        let roads = site.source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: struct => struct.structureType === STRUCTURE_ROAD
        });
        let roadsInProgress = site.source.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
            filter: /**ConstructionSite*/construction => construction.structureType === STRUCTURE_ROAD
        });

        let anhors = roads.map(r => r.pos).concat(roadsInProgress.map(r => r.pos));

        for(let a of anhors) {
            site.source.room.visual.circle(a, {fill: 'green', opacity: 0.7, radius: 0.3});
        }

        if(anhors.length < 1) {
            return;
        }

        let around = utils.getPositionsAround(site.source.pos);

        let terrain = Game.map.getRoomTerrain(site.source.pos.roomName);

        for(let /**RoomPosition*/ point of around) {
            if(!terrain.isWalkable(point.x, point.y)) {
                continue;
            }

            if(point.findInRange(anhors, 1).length > 0) {
                site.source.room.visual.circle(point, {fill: 'pink', opacity: 0.5, radius: 0.8});

                return site.source.room.createConstructionSite(point, STRUCTURE_CONTAINER);
            }
        }
    }

    toString() {
        return `[MiningSiteContainer for ${this.state.siteId}]`;
    }
}

procmgr.registerProcessType(MiningSiteContainer);

module.exports = {
    MiningSiteContainer
};