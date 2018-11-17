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

        this._authenticate()
            .then(() => { this.authenticated = true })
            .catch((e) => {
                this.authenticated = false
                return
            })

        this.putQueue = {
            items: {},
            callbacks: {},
            add(path, data) {
                return new Promise((resolve, reject) => {
                    if (typeof this.items[path] !== 'undefined' && this.items[path] !== null) {
                        this.items[path]["3311"][0] = Object.assign(this.items[path]["3311"][0], data["3311"][0]);
                        this.callbacks[path].push(resolve);
                    } else {
                        this.items[path] = data;
                        this.callbacks[path] = [resolve];
                        setTimeout(() => {
                            let data = Object.assign({}, this.items[path]);
                            this.items[path] = null;

                            let i = 0;
                            let d = data;
                            while (this.callbacks[path].length) {
                                if (i > 0) {
                                    d = null;
                                }
                                this.callbacks[path].shift()(d);
                                i++;
                            }
                        }, 50);
                    }
                });
            }
        };

    }

    _queue(cb) {
        typeof cb === 'function' && this.queue.push(cb);
    }

    _runLoop() {
        setInterval(() => {
            if (this.queue.length > 0 && this.session_secret !== null) {
                let fn = this.queue.shift();
                fn();
            }
        }, 20);
    }

    _authenticate() {
        return new Promise((resolve, reject) => {
            const coapCmd = `coap-client -m post -u "${this.username}" -k "${this.key}" -e '{"9090":"${this.session_key}"}' "coaps://${this.host}:5684/15011/9063"`;
            exec(coapCmd, execConfig, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                const split = stdout.trim().split("\n")
                const json = split.pop();
                try {
                    const response = JSON.parse(json);
                    console.log(response);
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
                const coapCmd = `coap-client -u '${this.session_key}' -k '${this.session_secret}' -B 5 coaps://${this.host}:5684/${path}`;
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
            this.putQueue.add(path, data).then(data => {
                if (data === null) {
                    resolve();
                    return;
                }
                const jsonData = JSON.stringify(data);
                this._queue(() => {
                    const coapCmd = `coap-client -u '${this.session_key}' -k '${this.session_secret}' -m PUT -e '${jsonData}' coaps://${this.host}:5684/${path}`;
                    exec(coapCmd, execConfig, (error) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve();
                    });
                });
            }).catch(reject);
        });
    }

    subscribe(path, callback) {
        const resourceUrl = `coaps://${this.host}:5684/${path}`;
        const processTimeout = Math.floor(Math.random() * 30 + 30);

        const process = spawn('coap-client', [
            '-u', this.session_key,
            '-k', this.session_secret,
            '-m', 'get',
            '-s', processTimeout + '',
            '-B', processTimeout + '',
            resourceUrl
        ]);

        process.stdout.on('data', stdout => {
            const split = stdout.toString().trim().split("\n")
            const json = split.pop();

            try {
                const response = JSON.parse(json);
                callback(response);
            } catch (e) {
                // console.error('Failed to decode JSON: ', e);
            }
        });
        let killer = setTimeout(() => {
            process.kill();
        }, processTimeout * 1000);
        process.on('close', () => {
            clearTimeout(killer);
            this.subscribe(path, callback);
        });
    }

}
