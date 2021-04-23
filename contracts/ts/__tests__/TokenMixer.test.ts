import { configMixer } from 'mixer-config'

import { testNetwork } from './testNetwork'

const { ArgumentParser } = require('argparse');
const parser = new ArgumentParser({
  description: 'test config'
});

parser.add_argument('-t');
parser.add_argument('--testPathPattern');
parser.add_argument('--network', { help: 'Set the network' });
parser.add_argument('--token', { help: 'Set the token' });
const arg = parser? parser.parse_args() : undefined

for (let configNetworkName of Object.keys(configMixer.get('network'))) {

  let configNetwork = configMixer.get('network.' + configNetworkName)

  if (((arg && arg.network && arg.network == configNetworkName) || !arg.network) && !(configNetwork.has('disable') && configNetwork.disable)){
      testNetwork(configNetworkName, configNetwork, arg)
  }
}
