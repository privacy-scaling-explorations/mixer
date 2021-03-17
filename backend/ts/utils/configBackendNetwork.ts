import * as ethers from 'ethers'

import { deployedAddresses } from 'mixer-contracts'
const configMixer =  require('../../exported_config')


const getTestParam = (network : string, token : string) => {
    const configNetwork = configMixer.network[network]
    const configToken = configNetwork.token[token]

    const gasLimitMix = configMixer.chain.gasLimit.mix

    const chainId = configNetwork.chainId
    const chainUrl = configNetwork.url
    const gasPrice = configNetwork.gasPrice
    const hotWalletPrivKeyPath = configNetwork.hotWalletPrivKeyPath
    const privateKeysPath = configNetwork.privateKeysPath


    const mixAmt = configToken.mixAmt
    const feeAmt = configToken.feeAmt
    let tokenDecimals = configToken.tokenDecimals

    let isETH = 1
    if (tokenDecimals){
        isETH = 0
    }else{
        tokenDecimals = 18
    }

    const deployedAddressesNetwork = deployedAddresses[network]
    const deployedAddressesToken = deployedAddressesNetwork.token[token]

    const relayerRegistryAddress = deployedAddressesNetwork.RelayerRegistryAddress
    const tokenAddress = deployedAddressesToken.Token
    const mixerAddress = deployedAddressesToken.Mixer
    const semaphoreAddress = deployedAddressesToken.Semaphore

    return {
        isETH,
        mixAmt,
        tokenDecimals,
        feeAmt,
        chainId,
        chainUrl,
        privateKeysPath,
        mixerAddress,
        tokenAddress,
    }
}

const getRelayerAddress = async (network) => {

    const configNetwork = configMixer.network[network]
    const privateKeysPath = configNetwork.privateKeysPath

    const hotWalletPrivKey = require("../" + privateKeysPath)

    const wallet = new ethers.Wallet(
        hotWalletPrivKey[1],
    )

    return await wallet.getAddress()
}

const getRelayerWallet = async (network) => {

    const configNetwork = configMixer.network[network]
    const privateKeysPath = configNetwork.privateKeysPath
    const chainId = configNetwork.chainId
    const chainUrl = configNetwork.url

    const hotWalletPrivKey = require("../" + privateKeysPath)

    const provider = new ethers.providers.JsonRpcProvider(
        chainUrl,
        chainId,
    )

    const wallet = new ethers.Wallet(
        hotWalletPrivKey[1],
        provider,
    )

    return await wallet
}

const getMixerInfo = async (network, mixer) => {

    const configNetwork = configMixer.network[network]

    const deployedAddressesNetwork = deployedAddresses[network]

    for (let configTokenName of Object.keys(configNetwork.token)) {

        const deployedAddressesToken = deployedAddressesNetwork.token[configTokenName]

        const mixerAddress = deployedAddressesToken.Mixer

        if (mixerAddress == mixer){
            const configToken = configNetwork.token[configTokenName]
            const semaphoreAddress = deployedAddressesToken.Semaphore
            const feeAmt = configToken.feeAmt
            const gasPrice = configNetwork.gasPrice
            const gasLimitMix = configMixer.chain.gasLimit.mix
            return {
                feeAmt: feeAmt,
                gasPrice: gasPrice,
                gasLimitMix: gasLimitMix,
                mixerAddress: mixerAddress,
                semaphoreAddress: semaphoreAddress,
            }
        }

    }
    return {
        feeAmt: null,
        gasPrice: null,
        gasLimitMix: null,
        mixerAddress: null,
        semaphoreAddress: null,
    }
}

export {
    getRelayerAddress,
    getRelayerWallet,
    getMixerInfo,
    getTestParam,
}
