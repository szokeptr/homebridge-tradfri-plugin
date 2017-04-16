# homebridge-tradfri

Ikea Tradfri Gateway plugin for [Homebridge](https://github.com/nfarina/homebridge).

Supported features:
- automatically discover your lights and list them
- turn on and off the lightbulbs
- adjust brightness
- adjust color temperature (far from perfect, better solutions than estimating the temperature from hue/saturation are welcome!)

![Brightness](https://pter.co/p/tradfri/brightness.PNG)
![Color](https://pter.co/p/tradfri/color.PNG)

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
2. Install this plugin using: `npm install -g homebridge-tradfri`
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
  "key": "PSK"
}
],
```

Of course, you will need to add the IP address of the Ikea gateway and the key, which is printed on the bottom of it.

# Contributing

The source can be found in the `src/` folder. The project is using webpack to transpile and bundle the source files. The configuration should work out of the box, you just need to run `webpack` to get it bundled. Don't forget to install the devDependencies too!

# Credit

Thanks to everyone discussing this in this issue: [https://github.com/bwssytems/ha-bridge/issues/570](https://github.com/bwssytems/ha-bridge/issues/570)

Also, special thanks to [stenehall](https://github.com/stenehall) for his project, [homebridge-ikea](https://github.com/stenehall/homebridge-ikea) which got me starting.
