import commandExists from 'command-exists';

const child_process = require('child_process');
const exec = child_process.exec;
const spawn = child_process.spawn;

const execConfig = {
    timeout: 5000
};

export default class Coap {

    constructor(host, username, key) {
        commandExists('coap-client').catch(() => {
            throw new Error('[Coap Client] libcoap is not found! Make sure coap-client is available on the command line!');
        });
        if (typeof host === 'undefined' || host === null) {
            throw new Error('[Coap Client] You must specify a valid host!');
        }
        this.host = host;
        this.username = username;
        this.key = key;

        this.session_key = 'homebridge-tradfri-plugin-' + Math.floor(Math.random() * 1000000);
        this.session_secret = null;

        this.queue = [];

        this._runLoop();

        this._authenticate();
    }

    _queue(cb) {
        typeof cb === 'function' && this.queue.push(cb);
    }

    _runLoop() {
        setInterval(() => {

            if (this.queue.length > 0 && this.session_secret !== null) {
                //console.log('running fn');
                let fn = this.queue.shift();
                fn();
            }
        }, 20);
    }

    _authenticate() {
        return new Promise((resolve, reject) => {
            const coapCmd = `coap-client -m post -u "${ this.username }" -k "${ this.key }" -e '{"9090":"${ this.session_key }"}' "coaps://${ this.host }:5684/15011/9063"`;

            exec(coapCmd, execConfig, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                const split = stdout.trim().split("\n")
                const json = split.pop();
                try {
                    const response = JSON.parse(json);
                    this.session_secret = response["9091"];

                    resolve(response);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    get(path) {
        return new Promise((resolve, reject) => {

            this._queue(() => {
                const coapCmd = `coap-client -u '${ this.session_key }' -k '${ this.session_secret }' -B 5 coaps://${ this.host }:5684/${ path }`;

                exec(coapCmd, execConfig, (error, stdout, stderr) => {

                    if (error) {
                        console.error(stderr);
                        reject(error);
                        return;
                    }

                    const split = stdout.trim().split("\n")
                    const json = split.pop();

                    try {
                        const response = JSON.parse(json);
                        resolve(response);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

        });
    }

    put(path, data) {
        return new Promise((resolve, reject) => {

            const jsonData = JSON.stringify(data);

            this._queue(() => {
                const coapCmd = `coap-client -u '${ this.session_key }' -k '${ this.session_secret }' -m PUT -e '${ jsonData }' coaps://${ this.host }:5684/${ path }`;
                exec(coapCmd, execConfig, (error) => {
                    if (error) {
                        console.log(error);
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });

        });
    }

    subscribe(path, callback) {
        const resourceUrl = `coaps://${ this.host }:5684/${ path }`;

        const process = spawn('coap-client', [
            '-u', this.username,
            '-k', this.key,
            '-m', 'get',
            '-s', '120',
            resourceUrl
        ]);

        process.stdout.on('data', stdout => {
            const split = stdout.toString().trim().split("\n")
            const json = split.pop();

            try {
                const response = JSON.parse(json);
                callback(response);
            } catch (e) {
            }
        });
        process.on('close', (code) => {
            this.subscribe(path, callback);
        });
    }

}
