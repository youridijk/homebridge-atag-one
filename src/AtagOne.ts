import fetch from 'node-fetch';
import dgram, {RemoteInfo} from 'dgram';
import {updateDeviceConfig} from './files';

export class AtagOne {
  private broadcastSocket = dgram.createSocket('udp4', this.handleBroadcastMessage);
  private deviceId?: string | undefined;
  private broadcastSocketIsStarted = false;

  constructor(
    private baseUrl?: string | undefined,
  ) {
  }

  public async updateData(controlData): Promise<void> {
    if (this.baseUrl === undefined) {
      throw new Error('Base url is undefined');
    }

    const body = {
      update_message: {
        seqnr: 0,
        account_auth: {
          user_account: '',
          mac_address: '',
        },
        control: controlData,
      },
    };

    const response = await fetch(this.baseUrl!, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error updating data, request responded with code ${response.status}`);
    }
  }

  public async getDataReport(): Promise<object> {
    if (this.baseUrl === undefined) {
      throw new Error('Base url is undefined!');
    }

    const body = {
      retrieve_message: {
        seqnr: 1,
        account_auth: {
          user_account: '',
          mac_address: '',
        },
        info: 8,
      },
    };

    // POST on the base url for getting data
    const response = await fetch(this.baseUrl!, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const responseJson = await response.json();

      // Example good response json
      //{
      //     "retrieve_reply": {
      //         "seqnr": 0,
      //         "status": {
      //             "device_id": YOUR_DEVICE_ID,
      //             "device_status": 16385,
      //             "connection_status": 7,
      //             "date_time": 694798163
      //         },
      //         "report": {
      //             "report_time": 694798163,
      //             "burning_hours": 6302.10,
      //             "device_errors": "",
      //             "boiler_errors": "",
      //             "room_temp": 20.4,
      //             "outside_temp": 4.3,
      //             "dbg_outside_temp": 22.1,
      //             "pcb_temp": 24.9,
      //             "ch_setpoint": 49.7,
      //             "dhw_water_temp": 46.1,
      //             "ch_water_temp": 55.0,
      //             "dhw_water_pres": 0.0,
      //             "ch_water_pres": 1.6,
      //             "ch_return_temp": 44.5,
      //             "boiler_status": 778,
      //             "boiler_config": 772,
      //             "ch_time_to_temp": 0,
      //             "shown_set_temp": 20.5,
      //             "power_cons": 7115,
      //             "tout_avg": 3.3,
      //             "rssi": 40,
      //             "current": -109,
      //             "voltage": 3752,
      //             "charge_status": 0,
      //             "lmuc_burner_starts": 36370,
      //             "dhw_flow_rate": 0.0,
      //             "resets": 28,
      //             "memory_allocation": 17320
      //         },
      //         "acc_status": 2
      //     }
      // }

      if ('retrieve_reply' in responseJson && 'report' in responseJson['retrieve_reply']) {
        return responseJson['retrieve_reply'];
      } else {
        throw new Error('Report key not found in response json!');
      }
    } else {
      throw new Error(`Error updating data, request responded with code ${response.status}`);
    }
  }

  public async getDeviceId(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    } else {
      const dataReport = await this.getDataReport();
      if ('status' in dataReport && 'device_id' in dataReport['status']) {
        return dataReport['status']['device_id'];
      } else {
        return 'Unknown';
      }
    }
  }

  private handleBroadcastMessage(message: Buffer, peer: RemoteInfo) {
    const decodedMessage = message.toString('utf8');
    if (decodedMessage.startsWith('ONE ')) {
      const newUrl = `http://${peer.address}:10000`;

      if (newUrl !== this.baseUrl) {
        this.baseUrl = newUrl;
        updateDeviceConfig(newUrl);

        if (this.newBaseUrlCallback) {
          this.newBaseUrlCallback(newUrl);
        }
      }
    }
  }

  private newBaseUrlCallback?: ((newBaseUrl: string) => void) | undefined;

  // Atag one thermostat sends every 10 seconds UDP broadcast message in the network
  public startBroadCastSocket(newBaseUrlCallback?: ((newBaseUrl: string) => void) | undefined) {
    this.newBaseUrlCallback = newBaseUrlCallback;
    if (!this.broadcastSocketIsStarted) {
      this.broadcastSocket.bind(11_000);
      this.broadcastSocketIsStarted = true;
    }
  }

  public closeBroadcastSocket() {
    if (this.broadcastSocket && this.broadcastSocketIsStarted) {
      this.broadcastSocket.close();
      this.broadcastSocketIsStarted = false;
    }
  }
}