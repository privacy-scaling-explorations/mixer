import * as ethers from 'ethers'

import { deployedAddresses } from 'mixer-contracts'
const configMixer =  require('../../exported_config')

const network = 'kovan'
const token = 'dai'
const configNetwork = configMixer.network[network]
const configToken = configNetwork.token[token]

const gasLimitMix = configMixer.chain.gasLimit.mix

const mixAmtEth = configNetwork.mixAmtEth
const feeAmtEth = configNetwork.feeAmtEth
const chainId = configNetwork.chainId
const chainUrl = configNetwork.url
const gasPrice = configNetwork.gasPrice
const relayerAddress = configNetwork.relayerAddress
const hotWalletPrivKeyPath = configNetwork.hotWalletPrivKeyPath
const testingPrivKeys = configNetwork.testing.privKeys

const mixAmtToken = configToken.mixAmtToken
const feeAmtToken = configToken.feeAmtToken
const tokenDecimals = configToken.tokenDecimals

const configEnv = configMixer.env

const backendHost = configMixer.backend.host
const backendPort = configMixer.backend.port

const etcdHost = configMixer.backend.etcd.host
const etcdPort = configMixer.backend.etcd.port
const etcdLockTime = configMixer.backend.etcd.lockTime

const deployedAddressesNetwork = deployedAddresses[network]
const deployedAddressesToken = deployedAddressesNetwork.token[token]

const relayerRegistryAddress = deployedAddressesNetwork.RelayerRegistryAddress
const mixerAddress = deployedAddressesNetwork.Mixer
const tokenMixerAddress = deployedAddressesToken.Mixer
const tokenAddress = deployedAddressesToken.Token
const semaphoreAddress = deployedAddressesToken.Semaphore
const tokenSemaphoreAddress = deployedAddressesToken.TokenSemaphore

export {
    mixAmtEth,
    mixAmtToken,
    feeAmtEth,
    chainId,
    chainUrl,
    tokenDecimals,
    feeAmtToken,
    backendHost,
    backendPort,
    hotWalletPrivKeyPath,
    etcdHost,
    etcdPort,
    etcdLockTime,
    gasLimitMix,
    gasPrice,
    configEnv,
    relayerAddress,
    relayerRegistryAddress,
    mixerAddress,
    tokenMixerAddress,
    tokenAddress,
    semaphoreAddress,
    tokenSemaphoreAddress,
    //TODO to fix
    testingPrivKeys,
}
