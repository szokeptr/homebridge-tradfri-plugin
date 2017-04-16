const transformData = data => {
  return {
    id: data['9003'],
    name: data['9001'],
    manufacturer: data['3']['0'],
    state: data['3311'][0]['5850'],
    brightness: Math.round(data['3311'][0]['5851'] / 254 * 100),
    colorX: data['3311'][0]['5709'],
    colorY: data['3311'][0]['5710']
  }
};

const hueToTemp = hue => {
  // these are just very-very rough translations of
  // hue to warm, neutral and cold white colors
  // of the Ikea Tradfri bulbs.
  if (hue > 150 && hue < 250) {
    // ~cold white
    return [33135, 27211];
  } else if (hue <= 150 || hue > 340) {
    // ~warm white
    return [33135, 27211];
  } else if (hue >= 250 && hue <= 340) {
    // ~neutral white
    return [30140, 26909];
  }
}

export default class TradfriAccessory {
  constructor(accessory, platform) {

    this.platform = platform;
    this.name = accessory['9001'];
    this.rawData = accessory;
    this.device = transformData(accessory);

  }

  identify(callback) {
    console.log('hi');
    callback();
  }

  getServices() {

    const Characteristic = this.platform.bridge.Characteristic;
    const accessoryInfo = new this.platform.bridge.Service.AccessoryInformation();

    accessoryInfo
      .setCharacteristic(Characteristic.Name, this.device.name)
      .setCharacteristic(Characteristic.Manufacturer, this.device.manufacturer)
      .setCharacteristic(Characteristic.Model, "Lamp");

    const lightbulbService = new this.platform.bridge.Service.Lightbulb(this.device.name);

    lightbulbService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getState.bind(this))
      .on('set', this.setState.bind(this));

    lightbulbService
      .getCharacteristic(Characteristic.Brightness)
      .on('get', this.getBrightness.bind(this))
      .on('set', this.setBrightness.bind(this));

    lightbulbService
      .getCharacteristic(Characteristic.Hue)
      .on('get', this.getHue.bind(this))
      .on('set', this.setHue.bind(this));

    lightbulbService.addCharacteristic(Characteristic.Saturation); // without this hue won't work either.


    return [accessoryInfo, lightbulbService];
  }

  async getState(callback) {
    const coap = this.platform.coap;

    const response = await coap.get(`15001/${ this.device.id }`);
    this.rawData = response;
    this.device = transformData(response);
    console.log('got state', this.device);
    callback(null, this.device.state);
  }

  async setState(state, callback) {
    const coap = this.platform.coap;
    this.device.state = state;
    const data = {
      "3311": [{
        "5850": state,
      }]
    };
    coap.put(`15001/${ this.device.id }`, data);

    callback();
  }

  async getBrightness(callback) {
    const coap = this.platform.coap;

    const response = await coap.get(`15001/${ this.device.id }`);

    this.device = transformData(response);
    console.log('got state', this.device);
    callback(null, this.device.brightness);
  }

  async setBrightness(brightness, callback) {
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

    coap.put(`15001/${ this.device.id }`, data);

    callback();
  }

  async getHue(callback) {
    const coap = this.platform.coap;

    const response = await coap.get(`15001/${ this.device.id }`);

    this.device = transformData(response);

    console.log('Color X,Y: ',this.device.colorX, this.device.colorY);

    // if (sat <= 12) {
    //   // neutral white light
    //   kelvin = 3500;
    // } else if (sat > 12 && sat <= 20) {
    //   // cold
    //   kelvin = 2200;
    // } else {
    //   // warm light
    //   kelvin = 6000;
    // }

    callback(null, 10);

  }

  async setHue(hue, callback) {
    const coap = this.platform.coap;

    const colors = hueToTemp(hue);

    this.device.colorX = colors[0];
    this.device.colorY = colors[1];
    const data = {
      "3311": [{
        "5709": colors[0],
        "5710": colors[1]
      }]
    };

    coap.put(`15001/${ this.device.id }`, data);

    callback();
  }

}
