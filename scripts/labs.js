var _ = require('lodash');


const RESOURCE_HYDROGEN = "H";
const RESOURCE_OXYGEN = "O";
const RESOURCE_UTRIUM = "U";
const RESOURCE_KEANIUM = "K";
const RESOURCE_LEMERGIUM = "L";
const RESOURCE_ZYNTHIUM = "Z";
const RESOURCE_CATALYST = "X";
const RESOURCE_HYDROXIDE = "OH";
const RESOURCE_ZYNTHIUM_KEANITE = "ZK";
const RESOURCE_UTRIUM_LEMERGITE = "UL";
const RESOURCE_GHODIUM = "G";
const RESOURCE_UTRIUM_HYDRIDE = "UH";
const RESOURCE_UTRIUM_OXIDE = "UO";
const RESOURCE_KEANIUM_HYDRIDE = "KH";
const RESOURCE_KEANIUM_OXIDE = "KO";
const RESOURCE_LEMERGIUM_HYDRIDE = "LH";
const RESOURCE_LEMERGIUM_OXIDE = "LO";
const RESOURCE_ZYNTHIUM_HYDRIDE = "ZH";
const RESOURCE_ZYNTHIUM_OXIDE = "ZO";
const RESOURCE_GHODIUM_HYDRIDE = "GH";
const RESOURCE_GHODIUM_OXIDE = "GO";
const RESOURCE_UTRIUM_ACID = "UH2O";
const RESOURCE_UTRIUM_ALKALIDE = "UHO2";
const RESOURCE_KEANIUM_ACID = "KH2O";
const RESOURCE_KEANIUM_ALKALIDE = "KHO2";
const RESOURCE_LEMERGIUM_ACID = "LH2O";
const RESOURCE_LEMERGIUM_ALKALIDE = "LHO2";
const RESOURCE_ZYNTHIUM_ACID = "ZH2O";
const RESOURCE_ZYNTHIUM_ALKALIDE = "ZHO2";
const RESOURCE_GHODIUM_ACID = "GH2O";
const RESOURCE_GHODIUM_ALKALIDE = "GHO2";
const RESOURCE_CATALYZED_UTRIUM_ACID = "XUH2O";
const RESOURCE_CATALYZED_UTRIUM_ALKALIDE = "XUHO2";
const RESOURCE_CATALYZED_KEANIUM_ACID = "XKH2O";
const RESOURCE_CATALYZED_KEANIUM_ALKALIDE = "XKHO2";
const RESOURCE_CATALYZED_LEMERGIUM_ACID = "XLH2O";
const RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE = "XLHO2";
const RESOURCE_CATALYZED_ZYNTHIUM_ACID = "XZH2O";
const RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE = "XZHO2";
const RESOURCE_CATALYZED_GHODIUM_ACID = "XGH2O";
const RESOURCE_CATALYZED_GHODIUM_ALKALIDE = "XGHO2";

const RESOURCES_BASE = [
    RESOURCE_UTRIUM,
    RESOURCE_KEANIUM,
    RESOURCE_ZYNTHIUM,
    RESOURCE_LEMERGIUM,
    RESOURCE_OXYGEN,
    RESOURCE_HYDROGEN,
    RESOURCE_CATALYST,
];

const REACTIONS = {
    H: {
        O: "OH",
        L: "LH",
        K: "KH",
        U: "UH",
        Z: "ZH",
        G: "GH"
    },
    O: {
        H: "OH",
        L: "LO",
        K: "KO",
        U: "UO",
        Z: "ZO",
        G: "GO"
    },
    Z: {
        K: "ZK",
        H: "ZH",
        O: "ZO"
    },
    L: {
        U: "UL",
        H: "LH",
        O: "LO"
    },
    K: {
        Z: "ZK",
        H: "KH",
        O: "KO"
    },
    G: {
        H: "GH",
        O: "GO"
    },
    U: {
        L: "UL",
        H: "UH",
        O: "UO"
    },
    OH: {
        UH: "UH2O",
        UO: "UHO2",
        ZH: "ZH2O",
        ZO: "ZHO2",
        KH: "KH2O",
        KO: "KHO2",
        LH: "LH2O",
        LO: "LHO2",
        GH: "GH2O",
        GO: "GHO2"
    },
    X: {
        UH2O: "XUH2O",
        UHO2: "XUHO2",
        LH2O: "XLH2O",
        LHO2: "XLHO2",
        KH2O: "XKH2O",
        KHO2: "XKHO2",
        ZH2O: "XZH2O",
        ZHO2: "XZHO2",
        GH2O: "XGH2O",
        GHO2: "XGHO2"
    },
    ZK: {
        UL: "G"
    },
    UL: {
        ZK: "G"
    },
    LH: {
        OH: "LH2O"
    },
    ZH: {
        OH: "ZH2O"
    },
    GH: {
        OH: "GH2O"
    },
    KH: {
        OH: "KH2O"
    },
    UH: {
        OH: "UH2O"
    },
    LO: {
        OH: "LHO2"
    },
    ZO: {
        OH: "ZHO2"
    },
    KO: {
        OH: "KHO2"
    },
    UO: {
        OH: "UHO2"
    },
    GO: {
        OH: "GHO2"
    },
    LH2O: {
        X: "XLH2O"
    },
    KH2O: {
        X: "XKH2O"
    },
    ZH2O: {
        X: "XZH2O"
    },
    UH2O: {
        X: "XUH2O"
    },
    GH2O: {
        X: "XGH2O"
    },
    LHO2: {
        X: "XLHO2"
    },
    UHO2: {
        X: "XUHO2"
    },
    KHO2: {
        X: "XKHO2"
    },
    ZHO2: {
        X: "XZHO2"
    },
    GHO2: {
        X: "XGHO2"
    }
};

function reverseReactions(reactions) {
    var results = {};

    _.each(reactions, (other, firstResource) => {
        _.each(other, (finalResource, secondResource) => {
            if(finalResource in results) {
                return;
            }
            results[finalResource] = [firstResource, secondResource];
        })
    });

    return results;
}

function getNextReaction(resource, amount, store) {

    let neededAmount = amount - (store[resource] || 0);

    store = _.omit(store, resource);

    if(store[resource] >= amount) {
        return null;
    }



    let toCheck = [REACTIONS_REVERSE[resource]];

    while(toCheck.length > 0) {
        let reaction = toCheck.pop();

        if((store[reaction[0]] || 0) < neededAmount && RESOURCES_BASE.indexOf(reaction[0]) < 0) {
            toCheck.push(REACTIONS_REVERSE[reaction[0]]);
            continue;
        }

        if((store[reaction[1]] || 0) < neededAmount && RESOURCES_BASE.indexOf(reaction[1]) < 0) {
            toCheck.push(REACTIONS_REVERSE[reaction[1]]);
            continue;
        }

        return reaction;
    }
}

global.REACTIONS_REVERSE = reverseReactions(REACTIONS);

// let storage = {
//     // [RESOURCE_ZYNTHIUM_KEANITE]: 2000,
//     // [RESOURCE_UTRIUM_LEMERGITE]: 2000,
//     [RESOURCE_GHODIUM]: 2000,
//     [RESOURCE_HYDROXIDE]: 2000,
//     // [RESOURCE_GHODIUM_OXIDE]: 2000,
//     [RESOURCE_GHODIUM_ALKALIDE]: 2000,
// };

let storage = {
    "energy": 26419,
    "H": 9000,
    "O": 42200,
    "U": 7660,
    "K": 22700,
    "L": 23000,
    "Z": 22840,
    "OH": 6710,
    "ZK": 3040,
    "UH": 2815,
    "LO": 280,
    "ZO": 540,
    "UH2O": 10,
    "KHO2": 2670,
    "LHO2": 2750,
    "ZHO2": 50,
    "GHO2": 2140,
    "XUH2O": 2070,
    "XLHO2": 3000,
    "XZHO2": 2630,
    "XGHO2": 3000
};

let nextReaction = getNextReaction(RESOURCE_LEMERGIUM_ALKALIDE, 3000, storage);

console.log('RRR', nextReaction);