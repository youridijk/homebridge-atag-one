import {API} from 'homebridge';

import {AtagThermostat} from './thermostat';
import {ACCESSORY_NAME, PLUGIN_NAME} from './settings';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, AtagThermostat);
};
