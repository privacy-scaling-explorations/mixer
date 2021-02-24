import * as ethers from 'ethers'
const mixerAbi = require('../../abis/Mixer-abi.json')
const semaphoreAbi = require('../../abis/Semaphore-abi.json')
const relayerRegistryAbi = require('../../abis/RelayerRegistry-abi.json')
const tokenAbi = require('../../abis/ERC20-abi.json')

import{
    chainId,
    tokenAddress,
    relayerRegistryAddress,
    mixerAddress,
    semaphoreAddress,
} from '../utils/configFrontend'

// It's not trivial to generalise these functions as Parcel won't let you
// dynamically require JSON files

const getRelayerRegistryContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        relayerRegistryAddress,
        relayerRegistryAbi,
        signer,
    )
}

const getMixerContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        mixerAddress,
        mixerAbi,
        signer,
    )
}

const getSemaphoreContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        semaphoreAddress,
        semaphoreAbi,
        signer,
    )
}

const getTokenContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        tokenAddress,
        tokenAbi,
        signer,
    )
}

export {
    getRelayerRegistryContract,
    getMixerContract,
    getSemaphoreContract,
    getTokenContract,
}
