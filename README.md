# homebridge-tradfri-plugin

[![npm version](https://badge.fury.io/js/homebridge-tradfri-plugin.svg)](https://badge.fury.io/js/homebridge-tradfri-plugin)

Ikea Tradfri Gateway plugin for [Homebridge](https://github.com/nfarina/homebridge).

Supported features:
- automatically discover your lights and list them
- turn on and off the lightbulbs
- adjust brightness
- adjust color temperature (far from perfect, better solutions than estimating the temperature from hue/saturation are welcome!)
- NEW: color temperature can be adjusted gradually, not just the 3 predefined values.
- NEW: support for outlets

![Brightness and Color](http://oo00oo.pw/media/tradfri-screenshots.png)

# Dependencies

The plugin talks to your gateway through COAP protocol, so you'll need to compile [libcoap](https://github.com/obgm/libcoap.git) yourself in order to get going. Instructions for macOS (you need homebrew or some other package manager installed):

```
brew install libtool

git clone --recursive https://github.com/obgm/libcoap.git
cd libcoap
git checkout dtls
git submodule update --init --recursive
./autogen.sh
./configure --disable-documentation --disable-shared
make
sudo make install
```

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-tradfri-plugin`
3. Update your configuration file. See the sample below.

# Configuration

You just need to add the platform to your `config.json` as shown below:

```
"platforms": [
...
{
  "platform": "IkeaTradfri",
  "name": "Tradfri",
  "host": "192.168.x.x",
  "key": "PSK",
  "ignoreBulbs": false // set to true to hide bulbs
}
],
```

Of course, you will need to add the IP address of the Ikea gateway and the key, which is printed on the bottom of it.

# Contributing

The source can be found in the `src/` folder. The project is using rollup to bundle the source files. You just need to run `npm run build` to get it bundled. Don't forget to install the devDependencies too!

# Todo

- improve color temperature conversion
- tests

# Credit

Thanks to everyone discussing this in this issue: [https://github.com/bwssytems/ha-bridge/issues/570](https://github.com/bwssytems/ha-bridge/issues/570)

Also, special thanks to [stenehall](https://github.com/stenehall) for his project, [homebridge-ikea](https://github.com/stenehall/homebridge-ikea) which got me starting.
