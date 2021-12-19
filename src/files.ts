import fs from 'fs';

const configFileName = 'device-config.json';

export function updateDeviceConfig(baseUrl: string) {
  // eslint-disable-next-line eqeqeq
  const data = {
    baseUrl,
  };

  fs.writeFileSync(configFileName, JSON.stringify(data));
}

export function readDeviceConfig(){
  if(fs.existsSync(configFileName)) {
    const file = fs.readFileSync(configFileName);
    return JSON.parse(file.toString('utf8'));
  }else{
    return {base_url: null};
  }
}

