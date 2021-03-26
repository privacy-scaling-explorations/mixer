import { genValidator } from './utils'
import {
    getBackendAddress,
} from '../utils/configBackendNetwork'
import {ethers} from 'ethers'

const _backendStatus = async (info) => {

    const backendAddress = await getBackendAddress(info.networkName)

    return {
        networkName: info.networkName,
        address: backendAddress,
    }
}

const backendStatusRoute = {
    route: _backendStatus,
    reqValidator: genValidator('backendStatus'),
}

export default backendStatusRoute
