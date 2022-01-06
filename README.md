# Atag One Homebridge plugin

This plugin adds HomeKit support for the Atag One Thermostat. This plugin requires no credentials for communicating with
the thermostat, because it communicates locally to the thermostat.

Example config.json

```json
{
  "accessory": "AtagOne",
  "name": "Atag One"
}
```

Optionally you can pass a `minimumTargetValue` key to the JSON to specify the lowest target temperature in HomeKit
(the default is 16℃).

In addition, you can specify an `ipAddress` key to specify the ip-address of the thermostat in case it can't be 
found in the network.

## Device discovery
To discover the thermostat in the local network, we can use the fact that the thermostat broadcasts a message 
approximately once every 10 seconds to the local network that it’s connected to. 
If you set up a listener for this message, you can access the IP-address of the device that sent the message. 
In our case this is the thermostat.

As long as Homebridge is running, this plugin will listen for this message. 
So, if the IP-address of the thermostat changes, this plugin detects it right away and will automatically use the 
newly found IP-address for communication.

An example config.json with these two keys:
```json
{
  "accessory": "AtagOne",
  "name": "Atag One",
  "minimumTargetValue": 10,
  "ipAddress": "10.0.0.19"
}
```