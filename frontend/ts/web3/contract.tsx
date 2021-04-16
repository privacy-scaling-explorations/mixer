import * as ethers from 'ethers'
const Mixer = require('../../compiled/Mixer.json')
const Semaphore = require('../../compiled/Semaphore.json')
const MixerRegistry = require('../../compiled/MixerRegistry.json')
const ForwarderRegistryERC20 = require('../../compiled/ForwarderRegistryERC20.json')
const Token = require('../../compiled/ERC20Mintable.json')

import{
    tokenAddress,
    forwarderRegistryERC20Address,
    mixerRegistryAddress,
} from '../utils/configFrontend'

// It's not trivial to generalise these functions as Parcel won't let you
// dynamically require JSON files

const getForwarderRegistryERC20Contract = async (provider) => {

    return new ethers.Contract(
        forwarderRegistryERC20Address,
        ForwarderRegistryERC20.abi,
        provider,
    )
}

const getMixerRegistryContract = async (provider) => {

    return new ethers.Contract(
        mixerRegistryAddress,
        MixerRegistry.abi,
        provider,
    )
}

const getMixerContract = async (provider, mixerAddress) => {

    return new ethers.Contract(
        mixerAddress,
        Mixer.abi,
        provider,
    )
}

const getTokenContract = async (provider, _tokenAddress?) => {
    if(!_tokenAddress){
        _tokenAddress = tokenAddress
    }
    return new ethers.Contract(
        _tokenAddress,
        Token.abi,
        provider,
    )
}

export {
    Mixer,
    ForwarderRegistryERC20,
    getForwarderRegistryERC20Contract,
    getMixerRegistryContract,
    getMixerContract,
    getTokenContract,
}
