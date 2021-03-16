import { genValidator } from './utils'
import {
    getRelayerAddress,
} from '../utils/configBackendNetwork'
import {ethers} from 'ethers'

const _backendStatus = async (info) => {

    const relayerAddress = await getRelayerAddress()

    return {
        networkName: info.networkName,
        address: relayerAddress,
    }
}

const backendStatusRoute = {
    route: _backendStatus,
    reqValidator: genValidator('backendStatus'),
}

export default backendStatusRoute
