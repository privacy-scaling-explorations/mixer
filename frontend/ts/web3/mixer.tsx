import * as ethers from 'ethers'
const Mixer = require('../../compiled/Mixer.json')
const Semaphore = require('../../compiled/Semaphore.json')
const RelayerRegistry = require('../../compiled/RelayerRegistry.json')
const Token = require('../../compiled/ERC20Mintable.json')

import{
    chainId,
    tokenAddress,
    relayerRegistryAddress,
    mixerAddress,
    semaphoreAddress,
} from '../utils/configFrontend'

// It's not trivial to generalise these functions as Parcel won't let you
// dynamically require JSON files

const getRelayerRegistryContract = async (provider) => {

    const signer = provider.getSigner()

    return new ethers.Contract(
        relayerRegistryAddress,
        RelayerRegistry.abi,
        signer,
    )
}

const getMixerContract = async (provider) => {

    const signer = provider.getSigner()

    return new ethers.Contract(
        mixerAddress,
        Mixer.abi,
        signer,
    )
}

const getSemaphoreContract = async (provider) => {

    const signer = provider.getSigner()

    return new ethers.Contract(
        semaphoreAddress,
        Semaphore.abi,
        signer,
    )
}

const getTokenContract = async (provider) => {

    const signer = provider.getSigner()

    return new ethers.Contract(
        tokenAddress,
        Token.abi,
        signer,
    )
}

export {
    Mixer,
    getRelayerRegistryContract,
    getMixerContract,
    getSemaphoreContract,
    getTokenContract,
}
