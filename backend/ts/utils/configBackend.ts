import * as ethers from 'ethers'

const config = require('../../exported_config')
const network = 'kovan'
const token = 'dai'
const configNetwork = config.network[network]
const configToken = configNetwork.token[token]

const gasLimitMix = config.chain.gasLimit.mix

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

const configEnv = config.env

const backendHost = config.backend.host
const backendPort = config.backend.port

const etcdHost = config.backend.etcd.host
const etcdPort = config.backend.etcd.port
const etcdLockTime = config.backend.etcd.lockTime

const deployedAddresses = require('../../deployedAddresses')
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
