const { ScreepsAPI } = require('screeps-api');
const fs = require('fs');
const moment = require('moment');

const screepsConfig = require('./screepsConfig');

const api = new ScreepsAPI({
  protocol: 'https',
  hostname: 'screeps.com',
  port: 443,
  path: '/'
});

api.auth(screepsConfig.login, screepsConfig.password).then(() => {
    console.log('AUTH DONE');

    return api.socket.connect();
}).then(() => {
    console.log('Connected');

    api.socket.subscribe('console', (event)=>{
        //event.data.messages.log // List of console.log output for tick
        for(let msg of event.data.messages.log) {
            console.log(`[${moment().format('HH:mm:ss')}] ${msg}`);
        }
    });
});
