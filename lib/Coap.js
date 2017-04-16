import commandExists from 'command-exists';

const exec = require('child_process').exec;

const execConfig = {
};

export default class Coap {

  constructor(host, username, key) {
    commandExists('coap-client').catch(() => {
      throw new Error('[Coap Client] libcoap is not found! Make sure coap-client is available on the command line!');
    });
    if (typeof host === 'undefined' || host === null) {
      throw new Error('[Coap Client] You must specify a valid host!');
    }
    this.host = host;
    this.username = username;
    this.key = key;
  }

  get(path) {
    return new Promise((resolve, reject) => {
      const coapCmd = `coap-client -u '${ this.username }' -k '${ this.key }' -B 5 coaps://${ this.host }:5684/${ path }`;

      exec(coapCmd, execConfig, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        const split = stdout.trim().split("\n")
        const json = split.pop();

        try {
          const response = JSON.parse(json);
          resolve(response);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  put(path, data) {
    return new Promise((resolve, reject) => {

      const jsonData = JSON.stringify(data);

      const coapCmd = `coap-client -u '${ this.username }' -k '${ this.key }' -B 5 -m PUT -e '${ jsonData }' coaps://${ this.host }:5684/${ path }`;
      console.log(`[Exec] ${ coapCmd }`);
      exec(coapCmd, execConfig, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        const split = stdout.trim().split("\n")
        const json = split.pop();

        try {
          const response = JSON.parse(json);
          resolve(response);
        } catch (e) {
          resolve();
        }
      });
    });
  }

}
