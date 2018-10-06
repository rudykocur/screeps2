var _ = require('lodash');

const maps = require('maps');
const utils = require('utils');
const flags = require('utils.flags');


class RouteManager extends utils.Loggable {
    constructor() {
        super();

        if(!('cache' in Memory)) {
            Memory.cache = {};
        }

        if(!('routes' in Memory.cache)) {
            Memory.cache.routes = {};
        }

        this.memory = Memory.cache.routes;
    }

    /**
     * @param {RoomObject} from
     * @param {RoomObject} to
     */
    registerRoute(from, to) {
        let cacheKey = `${from.pos.serialize()}-${to.pos.serialize()}`;

        if(cacheKey in this.memory) {
            let cachedData = this.memory[cacheKey];

            if(cachedData.updatedTime + 500 > Game.time) {
                return;
            }

        }

        if(from.pos.roomName === to.pos.roomName) {
            return;
        }

        if(!(from.pos.roomName in Game.rooms) || !(to.pos.roomName in Game.rooms)) {
            return;
        }

        let timer = new utils.Timer();
        timer.start();

        let path = maps.getMultiRoomPath(from.pos, to.pos);
        timer.stop();

        let route = path.slice();

        if(route[3].roomName === route[0].roomName) {
            route = route.slice(3);
        }

        if(route[route.length - 4] === route[route.length-1]) {
            route = route.slice(0, -3);
        }

        let firstWP = route[0];
        let lastWP = route[route.length-1];

        for(let step of route) {
            let room = Game.rooms[step.roomName];
            if(room) {
                room.visual.circle(step, {fill: 'transparent', stroke: 'yellow', radius: 0.4})
            }
        }

        let nextUpdateTime = Game.time + Math.floor(Math.random() * 21);

        this.saveRoute(from, to, firstWP, lastWP, route, nextUpdateTime);
        this.saveRoute(to, from, lastWP, firstWP, _(route).reverse().value(), nextUpdateTime);

        this.debug('Registered route', cacheKey, 'in', timer.usedTime, '. Length:', route.length);
    }

    saveRoute(from, to, startWP, endWP, route, nextUpdateTime) {
        this.memory[this.getCacheKey(from, to)] = {
            from: from.pos.serialize(),
            to: to.pos.serialize(),
            startWP: startWP.serialize(),
            endWP: endWP.serialize(),
            route: route.map(step => step.serialize()).join(';'),
            updatedTime: nextUpdateTime,
        };
    }

    /**
     * @param {RoomObject} from
     * @param {RoomObject} to
     * @param {RoomPosition} currentPos
     */
    findPath(from, to, currentPos, debug) {

        if(from.pos.roomName === to.pos.roomName) {
            return maps.getMultiRoomPath(currentPos, to.pos);
        }

        let timer = new utils.NamedTimer().start('load');

        let route = this.loadRoute(from, to);

        if(!route) {
            timer.stop('load');
            this.err('Invalid route', this.getCacheKey(from, to));
            return maps.getMultiRoomPath(from.pos, to.pos);
        }

        timer.stop('load').start('route1');

        let routeToStart;
        let allRouteSteps = route.route;

        let stepsInCurrentRoom = allRouteSteps.filter(step => currentPos.roomName === step.roomName);

        let startTargets = stepsInCurrentRoom.map(step => {return {pos: step}});

        let stepsNearCurrentPos = stepsInCurrentRoom.filter(step => currentPos.isNearTo(step));

        if(stepsNearCurrentPos.length > 0) {
            routeToStart = [];
        }
        else {
            routeToStart = maps.getMultiRoomPath(currentPos, route.startWP, {targets: startTargets})
                .slice(0, -1);
        }

        timer.stop('route1').start('route2');
        let routeFromEnd = maps.getMultiRoomPath(route.endWP, to.pos);
        timer.stop('route2');
        timer.start('adjust');

        let currentPosIsOnRoute = stepsInCurrentRoom.filter(step => step.isEqualTo(currentPos)).length > 0;

        let lastStartRoute;
        if(currentPosIsOnRoute || routeToStart.length === 0) {
            lastStartRoute = currentPos;
        }
        else {
            lastStartRoute = routeToStart[routeToStart.length - 1];
        }

        let stepsNearStart = stepsInCurrentRoom.filter(step => lastStartRoute.isNearTo(step));
        let furthestStepOnRouteNearStart = stepsNearStart.pop();
        let indexOfRouteToCutFromStart = route.route.indexOf(furthestStepOnRouteNearStart);

        route.route = route.route.slice(indexOfRouteToCutFromStart);

        // if(debug) {
            this.debugPath(route.route, {fill: 'green', stroke: 'yellow', radius: 0.4});
            this.debugPath(routeToStart, {fill: 'cyan', stroke: 'yellow', radius: 0.6});
            this.debugPath(routeFromEnd, {fill: 'blue', stroke: 'yellow', radius: 0.6});
        // }

        timer.stop('adjust');
        timer.start('final');

        let result = [];
        result.push(...routeToStart);
        result.push(...route.route);
        result.push(...routeFromEnd);

        if(currentPos.isEqualTo(result[0])) {
            result.shift();
        }

        timer.stop('final');

        if(debug) {
            // console.log('PATH CALC IN', timer);
        }

        return result;
    }

    loadRoute(from, to) {
        let cacheKey = this.getCacheKey(from, to);
        if(!(cacheKey in this.memory)) {
            this.warn('No route from', from, 'to', to, '::', this.getCacheKey(from, to));
            return null;
        }
        let cachedRoute = this.memory[cacheKey];

        return {
            startWP: RoomPosition.unserialize(cachedRoute.startWP),
            endWP: RoomPosition.unserialize(cachedRoute.endWP),
            route: cachedRoute.route.split(';').map(RoomPosition.unserialize),
        }
    }

    getCacheKey(from, to) {
        return `${from.pos.serialize()}-${to.pos.serialize()}`;
    }

    debugPath(path, style) {
        for(let step of path) {
            let room = Game.rooms[step.roomName];
            if(room) {
                room.visual.circle(step, style);
            }
        }
    }

    toString() {
        return '[RouteManager]';
    }
}

module.exports = {
    RouteManager
};