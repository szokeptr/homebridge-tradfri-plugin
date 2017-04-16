const exec = require('child_process').exec;

const execConfig = {

};

export default class Coap {

  constructor(host, username, key) {
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
          //console.error(`exec error: ${error} (${error.code})[${error.signal}]`);
          reject(error);
          return;
        }
        //console.log(`<coap-stdout>${ stdout }</coap-stdout>`);

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
          //console.error(`exec error: ${error} (${error.code})[${error.signal}]`);
          reject(error);
          return;
        }
        //console.log(`<coap-stdout>${ stdout }</coap-stdout>`);

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
