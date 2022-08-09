import fs from 'fs';

const configFileName = 'device-config.json';

export function updateDeviceConfig(baseUrl: string) {
  fs.writeFileSync(configFileName, JSON.stringify({baseUrl}));
}

export function readDeviceConfig(){
  if(fs.existsSync(configFileName)) {
    const file = fs.readFileSync(configFileName);
    return JSON.parse(file.toString('utf8'));
  }else{
    return {base_url: undefined};
  }
}

