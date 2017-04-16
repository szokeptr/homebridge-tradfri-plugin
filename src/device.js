const transformData = data => {
  return {
    id: data['9003'],
    name: data['9001'],
    manufacturer: data['3']['0'],
    state: data['3311'][0]['5850'],
    brightness: Math.round(data['3311'][0]['5851'] / 254 * 100),
    colorX: data['3311'][0]['5709'],
    colorY: data['3311'][0]['5710'],
    color: {
      hue: null
    }
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
    }

    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

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
}

let newColor = {};

export default class TradfriAccessory {
  constructor(accessory, platform) {
    this.platform = platform;

    this.device = transformData(accessory);
    this.name = this.device.name;
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

    lightbulbService
      .getCharacteristic(Characteristic.Saturation)
      .on('get', this.getSaturation.bind(this))
      .on('set', this.setSaturation.bind(this));

    return [accessoryInfo, lightbulbService];
  }

  async getState(callback) {
    const coap = this.platform.coap;

    const response = await coap.get(`15001/${ this.device.id }`);
    this.rawData = response;
    this.device = transformData(response);

    callback(null, this.device.state);
  }

  setState(state, callback) {
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
    coap.put(`15001/${ this.device.id }`, data);

    callback();
  }

  async getHue(callback) {
    const coap = this.platform.coap;

    const response = await coap.get(`15001/${ this.device.id }`);
    this.device = transformData(response);

    callback(null, this.device.colorX);
  }

  setHue(hue, callback) {
    newColor.h = hue/360;

    if (typeof newColor.s !== 'undefined') {
      this.updateColor(newColor.h, newColor.s).then(() => {
        newColor = {};
      });
    }

    callback();
  }

  async getSaturation(callback) {
    const coap = this.platform.coap;

    const response = await coap.get(`15001/${ this.device.id }`);
    this.device = transformData(response);

    callback(null, this.device.colorY);
  }

  setSaturation(saturation, callback) {
    newColor.s = saturation/100;

    if (typeof newColor.h !== 'undefined') {
      this.updateColor(newColor.h, newColor.s).then(() => {
        newColor = {};
      });
    }

    callback();
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
      coap.put(`15001/${ this.device.id }`, data).then(resolve).catch(reject);
    });
  }

}
