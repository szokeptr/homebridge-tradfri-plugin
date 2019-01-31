# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2019-01-31
- Add support for outlets
- Use [rollup](https://github.com/rollup/rollup) to for bundling
- Add option to ignore bulbs, since there is official support for them

## [1.1.3] - 2017-12-05
- Don't rely on coap-client -B flag for subscribe process killing

## [1.1.2] - 2017-12-05
- Re-added support for monitoring changes outside of HomeKit
- Subscribe child-processes are now more stable
- Grouped PUT requests that are sent in 50ms to the same path (bulb) - greatly improves stability of settings scenes  
- Create Changelog

## [1.1.1] - 2017-11-04
- Added a command queueing system
- Added support for DTLS sessions (requires latest firmware on Tradfri Gateway)
- Removed support for monitoring changes outside of HomeKit