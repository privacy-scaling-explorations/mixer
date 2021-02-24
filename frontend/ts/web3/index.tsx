import { Connectors } from 'web3-react'
const { InjectedConnector } = Connectors
const config = require('../../exported_config')

import{
    supportedNetwork,
} from '../utils/configFrontend'

const MetaMask = new InjectedConnector({
    supportedNetworks: [supportedNetwork]
})

export default { MetaMask }
