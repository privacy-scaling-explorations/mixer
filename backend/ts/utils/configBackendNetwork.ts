import * as ethers from 'ethers'

import { deployedAddresses } from 'mixer-contracts'
import { configMixer } from 'mixer-config'


const getTestParam = (network : string, token : string) => {
    const configNetwork = configMixer.network[network]
    const configToken = configNetwork.token[token]

    const chainId = configNetwork.chainId
    const chainUrl = configNetwork.url
    const hotWalletPrivKeyPath = configNetwork.hotWalletPrivKeyPath
    const privateKeysPath = configNetwork.privateKeysPath

    const mixAmt = configToken.mixAmt
    const feeAmt = configToken.feeAmt
    let tokenDecimals = configToken.decimals
    let isETH = 1
    if (tokenDecimals){
        isETH = 0
    }else{
        tokenDecimals = 18
    }

    const deployedAddressesNetwork = deployedAddresses[network]
    const deployedAddressesToken = deployedAddressesNetwork.token[token]

    const tokenAddress = deployedAddressesToken.Token
    const mixerAddress = deployedAddressesToken.Mixer
    console.log("mixerAddress", mixerAddress)
    const semaphoreAddress = deployedAddressesToken.Semaphore
    const forwarderRegistryERC20Address = deployedAddressesNetwork.ForwarderRegistryERC20

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
        forwarderRegistryERC20Address,
    }
}

const getBackendAddress = async (network) => {

    const configNetwork = configMixer.network[network]
    const privateKeysPath = configNetwork.privateKeysPath

    const hotWalletPrivKey = require("../../../" + privateKeysPath)

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

    const hotWalletPrivKey = require("../../../" + privateKeysPath)

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
            const forwarderRegistryERC20Address = deployedAddressesNetwork.ForwarderRegistryERC20
            const configToken = configNetwork.token[configTokenName]
            const semaphoreAddress = deployedAddressesToken.Semaphore
            const feeAmt = configToken.feeAmt
            let tokenDecimals = configToken.decimals

            if (!tokenDecimals){
                tokenDecimals = 18
            }

            return {
                feeAmt: feeAmt,
                tokenDecimals: tokenDecimals,
                mixerAddress: mixerAddress,
                semaphoreAddress: semaphoreAddress,
                forwarderRegistryERC20Address: forwarderRegistryERC20Address,
            }
        }

    }
    return {
        feeAmt: null,
        mixerAddress: null,
        semaphoreAddress: null,
    }
}

export {
    getBackendAddress,
    getRelayerWallet,
    getMixerInfo,
    getTestParam,
}
