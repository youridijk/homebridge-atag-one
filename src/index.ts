import {API} from 'homebridge';

import {AtagThermostat} from './thermostat';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerAccessory('Atag One', AtagThermostat);
};
