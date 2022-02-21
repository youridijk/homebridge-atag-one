import {AccessoryConfig, API, Characteristic, CharacteristicValue, HAPStatus, Logger, Service} from 'homebridge';
import {readDeviceConfig} from './files';
import {WithUUID} from 'hap-nodejs/dist/types';
import {AtagOne} from './AtagOne';

export class AtagThermostat {
  private readonly service: Service = new this.api.hap.Service.Thermostat();
  private readonly accessoryInformation = new this.api.hap.Service.AccessoryInformation();
  private readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private updateDate: Date = new Date();

  private thermostat: AtagOne;

  constructor(
    private readonly logger: Logger,
    private readonly config: AccessoryConfig,
    private readonly api: API,
  ) {
    const configIpAddress: string = config['ipAddress'];

    // eslint-disable-next-line eqeqeq
    const cacheUrl = (config['cacheUrl'] ?? true) == true;
    let baseUrl: string | undefined;

    // Optional ip of the thermostat can be entered in the config
    // This is just in case the ip can't be found in local network
    if(configIpAddress){
      baseUrl = `http://${configIpAddress}:10000`;
      this.logger.info('Loaded base url from config');
    } else if(cacheUrl){
      const {baseUrl: configBaseUrl} = readDeviceConfig();

      if(configBaseUrl){
        baseUrl = configBaseUrl;
        this.logger.info('Loaded base url from stored config');
      }
    }

    this.thermostat = new AtagOne(cacheUrl, baseUrl);
    this.thermostat.startBroadCastSocket((newBaseUrl, error) => {
      if(error){
        this.logger.error(`Error updating base URL in device-config.json: ${error}`);
      }else {
        this.logger.info(`New base url: ${newBaseUrl}`);
      }
    });

    this.initCharacteristics();

    // Set initial temperature so it doesn't return illegal values
    this.updateCharacteristicValues(16, 16, 0);
    this.getTemperatures().catch(error => this.logger.error(`Error getting temperatures in constructor: ${error}`));

    // close socket when program shuts down (for development with nodemon)
    process.on('SIGTERM', () => {
      // eslint-disable-next-line eqeqeq
      this.thermostat.closeBroadcastSocket();
    });
  }



  private initCharacteristics() {
    this.accessoryInformation
      .setCharacteristic(this.Characteristic.Manufacturer, 'Atag')
      .setCharacteristic(this.Characteristic.Model, 'Atag One Thermostat')
      .getCharacteristic(this.Characteristic.SerialNumber)
      // Getting device id is async, so we bind a getter to serial number
      .onGet(this.getSerial.bind(this));

    // Only getter for heating state, because Atag One determines this
    this.service.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingState.bind(this));

    // Only allow off and heating
    this.service.getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .setProps({
        minValue: 0,
        maxValue: 1,
        validValues: [0, 1],
      });

    // Min temperature for Atag One is 4 degrees Celsius but lower than 16 is not realistic
    // But you can change this in the config
    this.service.getCharacteristic(this.Characteristic.TargetTemperature)
      .setProps({
        minValue: this.config['minimumTargetValue'] || 16,
        maxValue: 25,
        minStep: 0.5,
      })
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    // Only add getter for current temperature because setter is unnecessary
    this.service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
  }

  private async getTemperatures() {
    const response = (await this.thermostat.getDataReport())['report'];
    // fourth bit of boiler_status is heating state, thanks to https://github.com/kozmoz/atag-one-api/wiki/Thermostat-Protocol
    this.updateCharacteristicValues(response['room_temp'], response['shown_set_temp'], (response['boiler_status'] & 8) === 8);
  }

  private updateCharacteristicValues(currentTemperature: CharacteristicValue, targetTemperature: CharacteristicValue,
    heatingState: CharacteristicValue) {
    this.service.updateCharacteristic(this.Characteristic.CurrentTemperature, currentTemperature);
    this.service.updateCharacteristic(this.Characteristic.TargetTemperature, targetTemperature);
    this.service.updateCharacteristic(this.Characteristic.CurrentHeatingCoolingState, heatingState);
  }

  getServices(): Service[] {
    return [this.service, this.accessoryInformation];
  }

  private readonly dateDiff = 5 * 1000;

  private async getCharacteristic(characteristic: WithUUID<{ new(): Characteristic }>) {
    const currentDate = new Date();
    const updateDate = this.updateDate;
    this.updateDate = new Date();

    const dateDifference = currentDate.getTime() - updateDate.getTime();

    // Only update all the characteristics if previous update is older than 5 seconds
    // This speeds up this plug-in and prevents updating the data for every Characteristic getter
    if (dateDifference >= this.dateDiff) {
      try {
        this.logger.debug(`Getting date report with characteristic: ${characteristic.name}`);
        await this.getTemperatures();
      } catch (e) {
        this.logger.error(`Error getting data report: ${e}`);
        throw new this.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    }

    return this.service.getCharacteristic(characteristic).value!;
  }

  private async getSerial(): Promise<string> {
    try {
      return await this.thermostat.getDeviceId();
    }catch (e) {
      this.logger.error(`Error getting serial: ${e}`);
      throw new this.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private async getTargetTemperature() {
    this.logger.debug('Getting target temperature');
    return this.getCharacteristic(this.Characteristic.TargetTemperature);
  }

  private async getCurrentTemperature(): Promise<CharacteristicValue> {
    this.logger.debug('Getting current temperature');
    return this.getCharacteristic(this.Characteristic.TargetTemperature);
  }

  private async getCurrentHeatingState(): Promise<CharacteristicValue> {
    this.logger.debug('Getting current heating state');
    return this.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState);
  }

  async setTargetTemperature(targetTemperature: CharacteristicValue) {
    try {
      this.logger.debug('Updating target temperature to ' + targetTemperature);
      const data = {ch_mode_temp: targetTemperature};
      await this.thermostat.updateData(data);
    }catch (e) {
      this.logger.error(`Error setting target temperature: ${e}`);
      throw new this.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }
}