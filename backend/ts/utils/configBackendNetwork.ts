import * as ethers from 'ethers'

import { deployedAddresses } from 'mixer-contracts'
const configMixer =  require('../../exported_config')

const network = 'ganache'
const token = 'eth'

const configNetwork = configMixer.network[network]
const configToken = configNetwork.token[token]

const gasLimitMix = configMixer.chain.gasLimit.mix

const chainId = configNetwork.chainId
const chainUrl = configNetwork.url
const gasPrice = configNetwork.gasPrice
const relayerAddress = configNetwork.relayerAddress
const hotWalletPrivKeyPath = configNetwork.hotWalletPrivKeyPath
console.log("hotWalletPrivKeyPath", hotWalletPrivKeyPath)
const testingPrivKeys = configNetwork.testing.privKeys

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

export {
    isETH,
    mixAmt,
    feeAmt,
    chainId,
    chainUrl,
    tokenDecimals,
    gasLimitMix,
    gasPrice,
    relayerAddress,
    relayerRegistryAddress,
    mixerAddress,
    tokenAddress,
    semaphoreAddress,
    //TODO to fix
    testingPrivKeys,
    hotWalletPrivKeyPath,
}
