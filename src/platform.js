import Coap from '../lib/Coap';
import TradfriDevice from './device';

let Accessory, Service, Characteristic, UUIDGen;

export class TradfriPlatform {


    constructor(log, config, api) {
        this.log = log;
        this.api = api;
        this.config = config;
        this.accessories = [];

        this.bridge = {};

        this.bridge.Accessory = homebridge.platformAccessory;
        this.bridge.Service = homebridge.hap.Service;
        this.bridge.Characteristic = homebridge.hap.Characteristic;
        this.bridge.uuid = homebridge.hap.uuid;

        Accessory = this.bridge.Accessory
        Service = this.bridge.Service
        Characteristic = this.bridge.Characteristic
        UUIDGen = this.bridge.uuid

        this.api.on('didFinishLaunching', () => {
            this.log('Launch finished')


            this.updateStatus()
        })

        setInterval(this.updateStatus.bind(this), 20000);
    }

    configureAccessory(accessory) {
        this.log(accessory.displayName, "Configure Accessory");
        var platform = this;

        // Set the accessory to reachable if plugin can currently process the accessory,
        // otherwise set to false and update the reachability later by invoking 
        // accessory.updateReachability()
        accessory.reachable = false;
        accessory.context.noServiceConfigured = true;

        accessory.on('identify', function (paired, callback) {
            this.log(accessory.displayName, "Identify!!!");
            callback();
        });


        this.log('Got accessory', accessory.name);

        this.accessories.push(accessory);
    }

    // Sample function to show how developer can add accessory dynamically from outside event
    async addAccessory(device) {
        this.log("Add Accessory", device.name);
        var platform = this;
        var uuid;

        uuid = UUIDGen.generate(device.name);

        console.log('UUID for', device.name, uuid)

        var newAccessory = new Accessory(device.device.name, uuid);
        newAccessory.on('identify', function (paired, callback) {
            platform.log(newAccessory.displayName, "Identify!!!");
            callback();
        });
        // Plugin can save context on accessory to help restore accessory in configureAccessory()
        // newAccessory.context.something = "Something"

        newAccessory.context.deviceId = device.device.id;
        newAccessory.context.noServiceConfigured = false;

        // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
        newAccessory.addService(device.getServices()[1]);

        this.accessories.push(newAccessory);
        await this.api.registerPlatformAccessories("homebridge-tradfri", "IkeaTradfri", [newAccessory]);
    }

    async removeAccessory(accessory) {
        this.log("Remove Accessory", JSON.stringify(accessory));
        await this.api.unregisterPlatformAccessories("homebridge-tradfri", "IkeaTradfri", accessory);
    }

    async updateStatus() {

        if (!this.coap || !this.coap.authenticated) {
            try {
                this.log("Setting up coap communication")
                this.coap = new Coap(this.config.host, 'Client_identity', this.config.key);
            } catch (e) {
                this.log.error("Could not communicate with tradfri", e)
                return
            }
        }

        let ids = [];
        try {
            ids = await this.coap.get('15001');
        } catch (e) {

            if (e.signal === 'SIGTERM') {
                this.log(`Command timed out: ${e.cmd}`);
            } else {
                this.log("Cannot get devices from gateway! Is the Host and Key correct in config.json?");
            }

            this.log(`Updating status for ${this.accessories.length} devices`)

            this.accessories.forEach(async (accessory)=>{
                await accessory.updateReachability(false);
                accessory.context.noServiceConfigured = true
            })

            return;
        }

        const knownAccessories = this.accessories.slice()
        const newIds = [];

        ids.forEach((id) => {
            const index = knownAccessories.findIndex(accessory => accessory.context.deviceId === id)
            if (index === -1) {
                newIds.push(id)
            } else {
                knownAccessories.splice(index, 1);
            }
        })

        for (let deviceId of ids) {
            try {
                const device = await this.coap.get(`15001/${deviceId}`);
                if (typeof device['3311'] !== 'undefined') { // Remotes are not supported
                    if (newIds.indexOf(deviceId) > -1) {
                        const tdevice = new TradfriDevice(device, this, this.log)
                        this.log('Adding new device to homekit', deviceId)
                        this.addAccessory(tdevice);
                    } else {
                        const accessory = this.accessories.find(accessory => accessory.context.deviceId === deviceId)

                        if (accessory) {
                            if (accessory.context.noServiceConfigured) {
                                try {
 
                                 const tdevice = new TradfriDevice(device, this, this.log);
                                    const service = accessory.getService(tdevice.device.name)
                                    await accessory.removeService(service);
                                    await accessory.addService(tdevice.getServices()[1]);
                                    accessory.context.noServiceConfigured = false;
                                } catch (e) {
                                    this.log.error("Problem updating device, removing it", e);                                  
                                    await this.api.unregisterPlatformAccessories("homebridge-tradfri", "IkeaTradfri", [accessory])
   
                                }
                            }
                            await accessory.updateReachability(true);
                        } else {
                            this.log.error("Code error", deviceId, "not found in accessories")
                        }
                    }
                }
            } catch (e) {

                this.log.error("Caught exception", e)

                if (e.signal === 'SIGTERM') {
                    this.log.error(`Command timed out: ${e.cmd}`);
                }
                const accessory = this.accessories.find(accessory => accessory.context.deviceId === deviceId);
                if (accessory) {
                    accessory.updateReachability(false);
                    accessory.context.noServiceConfigured = true
                }
            }
        }

        knownAccessories.forEach((accessory) => {
            this.removeAccessory(accessory)
        })
    }
}
