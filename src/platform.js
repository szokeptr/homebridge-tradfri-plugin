import Coap from '../lib/Coap';
import TradfriDevice from './device';

export class TradfriPlatform {

  constructor(log, config) {
    this.log = log;
    this.config = config;

    this.coap = new Coap(config.host, 'Client_identity', config.key);

    this.bridge = {};

    this.bridge.Accessory = homebridge.platformAccessory;
    this.bridge.Service = homebridge.hap.Service;
    this.bridge.Characteristic = homebridge.hap.Characteristic;
    // this.bridge.Characteristic = homebridge.hap.Characteristic;
    // this.bridge.UUIDGen = homebridge.hap.uuid;
  }

  async accessories(callback) {
    let ids = await this.coap.get('15001');
    let accessories = [];
    for (let deviceId of ids) {
      const device = await this.coap.get(`15001/${ deviceId }`);
      if (typeof device['3311'] !== 'undefined') { // Remotes are not supported
        accessories.push(new TradfriDevice(device, this));
      }
    }

    callback(accessories);

  }

}
