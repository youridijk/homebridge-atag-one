import fetch from 'node-fetch';

export class Communicator {
  public static async updateData(baseUrl: string, controlData) {
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

    return await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

  }

  public static async getDataReport(baseUrl: string) {
    // eslint-disable-next-line eqeqeq
    if (baseUrl == null) {
      // this.logger.debug(this.baseUrl);
      return null;
    }

    const body = {
      'retrieve_message': {
        seqnr: 1,
        account_auth: {
          user_account: '',
          mac_address: '',
        },
        info: 8,
      },
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      const responseJson = await response.json();
      return responseJson.retrieve_reply.report;
    } else {
      return null;
    }
  }
}