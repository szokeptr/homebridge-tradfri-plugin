import Logger from '../../lib/Logger.js';

const transformData = data => {
    return {
        id: data['9003'],
        name: data['9001'],
        manufacturer: data['3']['0'],
        state: data['3312'][0]['5850'],
    }
};

export default class TradfriAccessory {
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
