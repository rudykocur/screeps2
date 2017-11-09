const { ScreepsAPI } = require('screeps-api');
const fs = require('fs');

const cred = require('../screepsConfig');

// All options are optional
const api = new ScreepsAPI(cred);

api.auth().then(() => {
    console.log('AUTH OK');

    api.socket.connect().then(() => {
        console.log('SOCKET OK');

        api.socket.subscribe('code')

        api.socket.on('code', (msg) => {
            let data = msg.data;
            fs.mkdirSync(data.branch)
            for (let mod in data.modules) {
                let file = `${data.branch}/${mod}.js`
                fs.writeFileSync(file, data.modules[mod])
                console.log('Wrote', file)

            }
        })
    })
});