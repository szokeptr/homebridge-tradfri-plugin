import { TradfriPlatform } from './platform';

export default homebridgeInstance => {
    global.homebridge = homebridgeInstance;
    homebridgeInstance.registerPlatform('homebridge-tradfri', 'IkeaTradfri', TradfriPlatform);
};
