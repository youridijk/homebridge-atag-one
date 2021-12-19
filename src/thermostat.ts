import {AccessoryConfig, API, CharacteristicValue, Logging, Service} from 'homebridge';
import dgram from 'dgram';
import {readDeviceConfig, updateDeviceConfig} from './files';
import {Communicator} from './communicator';
import {chmod} from 'fs';

export class AtagThermostat {
  private readonly service: Service;
  private readonly Characteristic;
  private readonly logger: Logging;


  private targetTemperature: CharacteristicValue = 20.5;
  private currentTemperature: CharacteristicValue = 20.5;
  private currentHeatingStatus: CharacteristicValue = 1;

  private baseUrl;
  private readonly accountAuth = {
    user_account: '',
    mac_address: '',
  };

  constructor(logger: Logging, config: AccessoryConfig, api: API) {
    const deviceConfig = readDeviceConfig();
    this.baseUrl = deviceConfig.baseUrl;

    if(this.baseUrl != null){
      logger.debug('Loaded base url ' + this.baseUrl);
    }

    this.initSocket();

    this.service = new api.hap.Service.Thermostat();
    this.Characteristic = api.hap.Characteristic;
    this.logger = logger;

    this.service.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.service.getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .setProps({
        minValue: 0,
        maxValue: 1,
        validValues: [0, 1],
      });

    this.service.getCharacteristic(this.Characteristic.TargetTemperature)
      .setProps({
        minValue: 16,
        maxValue: 25,
        minStep: 0.5,
      })
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    this.service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // this.logger.debug("UR: : " + this.baseUrl);

    // close socket when program shuts down (for development with nodemon)
    process.on('SIGTERM', () => {
      // eslint-disable-next-line eqeqeq
      if (this.broadcastSocket != null) {
        this.broadcastSocket.close();
      }
    });
  }

  private broadcastSocket;

  // Atag one thermostat sends every 10 seconds UDP broadcast message in the network
  private initSocket() {
    this.broadcastSocket = dgram.createSocket('udp4', (message, peer) => {
      const decodedMessage = message.toString('utf8');
      if (decodedMessage.startsWith('ONE ')) {
        const newUrl = `http://${peer.address}:10000`;

        if (newUrl !== this.baseUrl) {
          this.baseUrl = newUrl;
          this.logger.debug(`New base url: ${newUrl}`);
          updateDeviceConfig(this.baseUrl);
          this.updateTemperatures().then(null);
        }
      }
    });
    this.broadcastSocket.bind(11_000);
  }

  private async updateTemperatures() {
    const response = await Communicator.getDataReport(this.baseUrl);

    // eslint-disable-next-line eqeqeq
    if(response == null){
      this.logger.debug('Could not update data after new base url');
    }else{
      this.updateCharacteristicValues(response.room_temp, response.shown_set_temp, response.boiler_status & 8);
    }
  }

  getServices() {
    return [this.service];
  }

  private async getTargetTemperature(): Promise<CharacteristicValue> {
    const response = await Communicator.getDataReport(this.baseUrl);
    // eslint-disable-next-line eqeqeq
    if (response == null) {
      this.logger.debug('Response is null');
      return 16;
    } else {
      this.updateCharacteristicValues(response.room_temp, response.shown_set_temp, response.boiler_status & 8);
      return response.shown_set_temp;
    }
  }

  private async getCurrentTemperature(): Promise<CharacteristicValue> {
    const response = await Communicator.getDataReport(this.baseUrl);
    // eslint-disable-next-line eqeqeq
    if (response == null) {
      return 16;
    } else {
      this.updateCharacteristicValues(response.room_temp, response.shown_set_temp, response.boiler_status & 8);
      return response.room_temp;
    }
  }

  private async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    const response = await Communicator.getDataReport(this.baseUrl);
    // eslint-disable-next-line eqeqeq
    if (response == null) {
      return 0;
    } else {
      this.updateCharacteristicValues(response.room_temp, response.shown_set_temp, response.boiler_status & 8);
      return response.boiler_status & 8;
    }
  }

  async setTargetTemperature(targetTemperature: CharacteristicValue) {
    this.targetTemperature = targetTemperature;
    const data = {ch_mode_temp: targetTemperature};
    await Communicator.updateData(this.baseUrl, data);
  }

  private updateCharacteristicValues(currentTemperature: CharacteristicValue, targetTemperature: CharacteristicValue,
    heatingState: CharacteristicValue){
    this.updateCurrentTemperature(currentTemperature);
    this.updateTargetTemperature(targetTemperature);
    this.updateHeatingState(heatingState);
  }

  private updateCurrentTemperature(temperature: CharacteristicValue){
    this.service.updateCharacteristic(this.Characteristic.CurrentTemperature, temperature);
  }

  private updateTargetTemperature(temperature: CharacteristicValue){
    this.service.updateCharacteristic(this.Characteristic.TargetTemperature, temperature);
  }

  private updateHeatingState(state: CharacteristicValue){
    this.service.updateCharacteristic(this.Characteristic.CurrentHeatingCoolingState, state);
  }
}

