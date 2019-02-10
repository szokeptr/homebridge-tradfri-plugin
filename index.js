'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var commandExists = _interopDefault(require('command-exists'));

const child_process = require('child_process');
const exec = child_process.exec;
const spawn = child_process.spawn;

const execConfig = {
    timeout: 5000
};

class Coap {

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
            const coapCmd = `coap-client -m post -u "${ this.username }" -k "${ this.key }" -e '{"9090":"${ this.session_key }"}' "coaps://${ this.host }:5684/15011/9063"`;
            exec(coapCmd, execConfig, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                const split = stdout.trim().split("\n");
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
                const coapCmd = `coap-client -u '${ this.session_key }' -k '${ this.session_secret }' -B 5 coaps://${ this.host }:5684/${ path }`;
                exec(coapCmd, execConfig, (error, stdout, stderr) => {
                    if (error) {
                        console.error(stderr);
                        reject(error);
                        return;
                    }
                    const split = stdout.trim().split("\n");
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
                    const coapCmd = `coap-client -u '${ this.session_key }' -k '${ this.session_secret }' -m PUT -e '${ jsonData }' coaps://${ this.host }:5684/${ path }`;
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
        const resourceUrl = `coaps://${ this.host }:5684/${ path }`;
        const processTimeout = Math.floor(Math.random()*30 + 30);

        const process = spawn('coap-client', [
            '-u', this.session_key,
            '-k', this.session_secret,
            '-m', 'get',
            '-s', processTimeout + '',
            '-B', processTimeout + '',
            resourceUrl
        ]);

        process.stdout.on('data', stdout => {
            const split = stdout.toString().trim().split("\n");
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

class Logger {

    info() {
        console.log('[Info]: ', ...arguments);
    }

}

const transformData = data => {
    return {
        id: data['9003'],
        name: data['9001'],
        manufacturer: data['3']['0'],
        state: data['3311'][0]['5850'],
        brightness: Math.round(data['3311'][0]['5851'] / 254 * 100),
        colorTemperature: data['3311'][0]['5711'],
        colorX: data['3311'][0]['5709'],
        colorY: data['3311'][0]['5710'],
    }
};

const xToHue = x => {
    switch (x) {
        case 29600:
            // cold
            return 0.616 * 360;
        case 44200:
            // warm
            return 0.0833 * 360;
        default:
            // neutral
            return 0.833 * 360;
    }
};

// Source: http://stackoverflow.com/a/9493060
const hslToRgb = (h, s, l) => {
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

// Source http://stackoverflow.com/a/36061908
const rgbToXy = (red,green,blue) => {
    red = (red > 0.04045) ? Math.pow((red + 0.055) / (1.0 + 0.055), 2.4) : (red / 12.92);
    green = (green > 0.04045) ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : (green / 12.92);
    blue = (blue > 0.04045) ? Math.pow((blue + 0.055) / (1.0 + 0.055), 2.4) : (blue / 12.92);
    var X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
    var Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
    var Z = red * 0.000088 + green * 0.072310 + blue * 0.986039;
    var fx = X / (X + Y + Z);
    var fy = Y / (X + Y + Z);
    return [fx.toPrecision(4),fy.toPrecision(4)];
};

let newColor = {};

class TradfriAccessory {
    constructor(accessory, platform, log) {
        this.platform = platform;

        this.device = transformData(accessory);
        this.name = `${ this.device.name } - ${ this.device.id }`;

        if (typeof log === 'undefined') {
            this.log = new Logger;
        } else {
            this.log = log;
        }

        this.subscribe();
    }

    identify(callback) {
        callback(this.device.name);
    }

    getServices() {

        const Characteristic = this.platform.bridge.Characteristic;
        const accessoryInfo = new this.platform.bridge.Service.AccessoryInformation();

        accessoryInfo
            .setCharacteristic(Characteristic.Name, this.device.name)
            .setCharacteristic(Characteristic.Manufacturer, this.device.manufacturer)
            .setCharacteristic(Characteristic.Model, "Tradfri");

        const lightbulbService = this.service = new this.platform.bridge.Service.Lightbulb(this.device.name);

        lightbulbService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getState.bind(this))
            .on('set', this.setState.bind(this));

        lightbulbService
            .getCharacteristic(Characteristic.Brightness)
            .on('get', this.getBrightness.bind(this))
            .on('set', this.setBrightness.bind(this));

        if (typeof this.device.colorTemperature !== 'undefined') {
            lightbulbService
                .getCharacteristic(Characteristic.ColorTemperature)
                .on('get', this.getColorTemp.bind(this))
                .on('set', this.setColorTemp.bind(this));
	} else {
	    this.log.debug("Could not find color Temperature for " + this.device.name);		
	}
        if (typeof this.device.colorX !== 'undefined') {
            lightbulbService
                .getCharacteristic(Characteristic.Hue)
                .on('get', this.getHue.bind(this))
                .on('set', this.setHue.bind(this));

            lightbulbService
                .getCharacteristic(Characteristic.Saturation)
                .on('get', this.getSaturation.bind(this))
                .on('set', this.setSaturation.bind(this));
        }

        return [accessoryInfo, lightbulbService];
    }

    subscribe() {
        const coap = this.platform.coap;
        coap.subscribe(`15001/${ this.device.id }`, data => {
            this.handleChanges(transformData(data));
        });
    }

    handleChanges(data) {
        const Characteristic = this.platform.bridge.Characteristic;
        if (data.state !== this.device.state) {
            this.device.state = data.state;
            this.service.updateCharacteristic(Characteristic.On, data.state === 1 ? true : false);
        }
        if (data.brightness !== this.device.brightness) {
            this.device.brightness = data.brightness;
            this.service.updateCharacteristic(Characteristic.Brightness, data.brightness);
        }
    }

    getState(callback) {
        callback(null, this.device.state);
    }

    setState(state, callback) {
        const coap = this.platform.coap;

        // Sometimes (when using Siri) HomeKit sends boolean
        // value as state, so we need to cast that to int
        // See: https://github.com/szokeptr/homebridge-tradfri-plugin/issues/4#issue-222257475
        if (typeof state !== 'number') {
            state = state ? 1 : 0;
        }
        this.device.state = state;
        const data = {
            "3311": [{
                "5850": state,
            }]
        };
        coap.put(`15001/${ this.device.id }`, data).then(() => {
            callback(null);
        }).catch(err => {
            callback(null);
        });

    }

    getBrightness(callback) {
        callback(null, this.device.brightness);
    }

    setBrightness(brightness, callback) {
        const coap = this.platform.coap;

        if (brightness > 0) {
            this.device.state = 1;
        }

        this.device.brightness = brightness;
        const data = {
            "3311": [{
                "5851": Math.round(brightness * 2.54),
            }]
        };
        coap.put(`15001/${ this.device.id }`, data).then(() => {
            callback(null);
        }).catch(err => {
            callback(null);
        });
    }

    getColorTemp(callback) {
        callback(null, this.device.colorTemperature);
    }

    setColorTemp(temp, callback) {
        const coap = this.platform.coap;
	this.device.colorTemperature = temp;
	this.log.info("Set color temp to " + temp);
	const data = {
	    "3311": [{
		"5711": temp
	    }]
	};
	coap.put(`15001/${ this.device.id }`, data).then(() => {
	    callback(null);
	}).catch(err => {
	    callback(null);
	});
    }

    getHue(callback) {
        callback(null, xToHue(this.device.colorX));
    }

    setHue(hue, callback) {
        newColor.h = hue/360;

        if (typeof newColor.s !== 'undefined') {
            this.updateColor(newColor.h, newColor.s).then(() => {
                newColor = {};
                callback(null);
            }).catch(err => {
                callback(null);
            });
        } else {
            callback(null);
        }

    }

    getSaturation(callback) {
        this.getState(() => {
            callback(null, this.device.colorY);
        });
    }

    setSaturation(saturation, callback) {
        newColor.s = saturation/100;

        if (typeof newColor.h !== 'undefined') {
            this.updateColor(newColor.h, newColor.s).then(() => {
                newColor = {};
                callback(null);
            }).catch(err => {
                callback(null);
            });
        } else {
            callback(null);
        }
    }

    updateColor(hue, saturation) {
        const coap = this.platform.coap;
        return new Promise((resolve, reject) => {
            // First we convert hue and saturation
            // to RGB, with 75% lighntess
            const rgb = hslToRgb(hue, saturation, 0.75);
            // Then we convert the rgb values to
            // CIE L*a*b XY values
            const cie = rgbToXy(...rgb).map(item => {
                // we need to scale the values
                return Math.floor(100000 * item);
            });

            this.device.colorX = cie[0];
            this.device.colorY = cie[1];

            const data = {
                "3311": [{
                    "5709": cie[0],
                    "5710": cie[1]
                }]
            };
            coap.put(`15001/${ this.device.id }`, data).then(() => {
                resolve();
            }).catch(reject);
        });
    }
}

const transformData$1 = data => {
    return {
        id: data['9003'],
        name: data['9001'],
        manufacturer: data['3']['0'],
        state: data['3312'][0]['5850'],
    }
};

class TradfriAccessory$1 {
    constructor(accessory, platform, log) {
        this.platform = platform;

        this.device = transformData$1(accessory);
        this.name = `${ this.device.name } - ${ this.device.id }`;

        if (typeof log === 'undefined') {
            this.log = new Logger;
        } else {
            this.log = log;
        }

        this.subscribe();
    }

    identify(callback) {
        callback(this.device.name);
    }

    getServices() {

        const Characteristic = this.platform.bridge.Characteristic;
        const accessoryInfo = new this.platform.bridge.Service.AccessoryInformation();

        accessoryInfo
            .setCharacteristic(Characteristic.Name, this.device.name)
            .setCharacteristic(Characteristic.Manufacturer, this.device.manufacturer)
            .setCharacteristic(Characteristic.Model, "Tradfri");

        const lightbulbService = this.service = new this.platform.bridge.Service.Outlet(this.device.name);

        lightbulbService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getState.bind(this))
            .on('set', this.setState.bind(this));

        return [accessoryInfo, lightbulbService];
    }

    subscribe() {
        const coap = this.platform.coap;
        coap.subscribe(`15001/${ this.device.id }`, data => {
            this.handleChanges(transformData$1(data));
        });
    }

    handleChanges(data) {
        const Characteristic = this.platform.bridge.Characteristic;
        if (data.state !== this.device.state) {
            this.device.state = data.state;
            this.service.updateCharacteristic(Characteristic.On, data.state === 1 ? true : false);
        }
        if (data.brightness !== this.device.brightness) {
            this.device.brightness = data.brightness;
            this.service.updateCharacteristic(Characteristic.Brightness, data.brightness);
        }
    }

    getState(callback) {
        callback(null, this.device.state);
    }

    setState(state, callback) {
        const coap = this.platform.coap;

        // Sometimes (when using Siri) HomeKit sends boolean
        // value as state, so we need to cast that to int
        // See: https://github.com/szokeptr/homebridge-tradfri-plugin/issues/4#issue-222257475
        if (typeof state !== 'number') {
            state = state ? 1 : 0;
        }
        this.device.state = state;
        const data = {
            "3312": [{
                "5850": state,
            }]
        };
        coap.put(`15001/${ this.device.id }`, data).then(() => {
            callback(null);
        }).catch(err => {
            callback(null);
        });

    }
}

class TradfriPlatform {

    constructor(log, config) {
        this.log = log;
        this.config = config;

        this.coap = new Coap(config.host, 'Client_identity', config.key);

        this.bridge = {};

        this.bridge.Accessory = homebridge.platformAccessory;
        this.bridge.Service = homebridge.hap.Service;
        this.bridge.Characteristic = homebridge.hap.Characteristic;
        // this.bridge.Characteristic = homebridge.hap.Characteristic;
        this.bridge.uuid = homebridge.hap.uuid;
    }

    async accessories(callback) {
        let ids = [];
        try {
            ids = await this.coap.get('15001');
        } catch (e) {

            if (e.signal === 'SIGTERM') {
                this.log.error(`Command timed out: ${ e.cmd }`);
            } else {
                this.log.error("Cannot get devices from gateway! Is the Host and Key correct in config.json?");
            }
            callback([]);
            return;
        }

        let accessories = [];
        for (let deviceId of ids) {
            try {
                const device = await this.coap.get(`15001/${ deviceId }`);
                if (typeof device['3311'] !== 'undefined' && this.config.ignoreBulbs !== true) { // Add device if it's a buld
                    accessories.push(new TradfriAccessory(device, this, this.log));
                }

                if (typeof device['3312'] !== 'undefined') { // Add device if it's an outlet
                    accessories.push(new TradfriAccessory$1(device, this, this.log));
                }
            } catch (e) {
                if (e.signal === 'SIGTERM') {
                    this.log.error(`Command timed out: ${ e.cmd }`);
                } else {
                    this.log.error(`Failed to get device id: ${ deviceId }`);
                }
            }

        }

        callback(accessories);

    }

}

var plugin = homebridgeInstance => {
    global.homebridge = homebridgeInstance;
    homebridgeInstance.registerPlatform('homebridge-tradfri', 'IkeaTradfri', TradfriPlatform);
};

module.exports = plugin;
