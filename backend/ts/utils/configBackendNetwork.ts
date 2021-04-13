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
    const forwarderRegistryERC20Address = deployedAddressesNetwork.ForwarderRegistryERC20

    return {
        isETH,
        tokenDecimals,
        feeAmt,
        chainId,
        chainUrl,
        privateKeysPath,
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

const getMixerInfo = async (network, tokenAddress) => {
    const configNetwork = configMixer.network[network]
    tokenAddress = tokenAddress?
        ethers.utils.getAddress(tokenAddress) :
        undefined
    const deployedAddressesNetwork = deployedAddresses[network]
    for (let configTokenName of Object.keys(configNetwork.token)) {
        const configToken = configNetwork.token[configTokenName]
        let isToken = false
        if (tokenAddress){
            isToken = configToken.address ?
                tokenAddress == ethers.utils.getAddress(configToken.address) :
                false
            if (!isToken){
                try {
                    if (tokenAddress == ethers.utils.getAddress(deployedAddressesNetwork.token[configTokenName].Token)){
                        isToken = true
                    }
                } catch (err){
                    //May not be present in file
                }
            }
        } else {
            isToken = configToken.decimals ? false : true
        }

        if (isToken){
            const forwarderRegistryERC20Address = deployedAddressesNetwork.ForwarderRegistryERC20

            const feeAmt = configToken.feeAmt
            let tokenDecimals = configToken.decimals

            if (!tokenDecimals){
                tokenDecimals = 18
            }

            return {
                feeAmt: feeAmt,
                tokenDecimals: tokenDecimals,
                forwarderRegistryERC20Address: forwarderRegistryERC20Address,
            }
        }
    }

    return {
        feeAmt: undefined,
    }
}

export {
    getBackendAddress,
    getRelayerWallet,
    getMixerInfo,
    getTestParam,
}
