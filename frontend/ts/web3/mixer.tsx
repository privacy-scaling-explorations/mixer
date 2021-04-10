import * as ethers from 'ethers'
const Mixer = require('../../compiled/Mixer.json')
const Semaphore = require('../../compiled/Semaphore.json')
const MixerRegistry = require('../../compiled/MixerRegistry.json')
const ForwarderRegistryERC20 = require('../../compiled/ForwarderRegistryERC20.json')
const Token = require('../../compiled/ERC20Mintable.json')

import{
    chainId,
    tokenAddress,
    forwarderRegistryERC20Address,
    mixerRegistryAddress,
    mixerAddress,
    semaphoreAddress,
} from '../utils/configFrontend'

// It's not trivial to generalise these functions as Parcel won't let you
// dynamically require JSON files

const getForwarderRegistryERC20Contract = async (provider) => {

    const signer = provider.getSigner()

    return new ethers.Contract(
        forwarderRegistryERC20Address,
        ForwarderRegistryERC20.abi,
        signer,
    )
}

const getMixerRegistryContract = async (provider) => {

    const signer = provider.getSigner()

    return new ethers.Contract(
        mixerRegistryAddress,
        MixerRegistry.abi,
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
    getForwarderRegistryERC20Contract,
    getMixerRegistryContract,
    getMixerContract,
    getSemaphoreContract,
    getTokenContract,
}
