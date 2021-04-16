//require('module-alias/register')
//require('events').EventEmitter.defaultMaxListeners = 0

import { configMixer } from 'mixer-config'


import { testNetwork } from './testNetwork'

for (let configNetworkName of Object.keys(configMixer.get('network'))) {

  let configNetwork = configMixer.get('network.' + configNetworkName)

  if (!(configNetwork.has('disable') && configNetwork.disable)){
      testNetwork(configNetworkName, configNetwork)
  }
}
