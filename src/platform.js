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
        if (typeof device['3311'] !== 'undefined') { // Remotes are not supported
          accessories.push(new TradfriDevice(device, this, this.log));
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
