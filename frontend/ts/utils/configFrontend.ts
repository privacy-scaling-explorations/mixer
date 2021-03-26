import * as ethers from 'ethers'

const configMixer = require('../../exported_config')
import { deployedAddresses } from 'mixer-contracts'

const localStorage = window.localStorage

const setNetworkStorage = (network: string) => {
    localStorage.setItem('network', network)
}

const getNetworkStorage = () => {
    return localStorage.getItem('network')
}

const setTokenStorage = (network: string, token: string) => {
    localStorage.setItem(network + '.token', token)
}

const getTokenStorage = (network: string) => {
    return localStorage.getItem(network + '.token')
}

function setNetwork(_network : string) {
    let oldNetwork = getNetworkStorage()
    if (oldNetwork != _network){
        setNetworkStorage(_network)
        network = _network
        console.log("network : ", network)
        window.location.reload(false);
    }
}

function setToken(network : string, _token : string) {
    let oldToken = getTokenStorage(network)
    if (oldToken != _token){
        setTokenStorage(network, _token)
        token = _token
        console.log("token : ", token)
        window.location.reload(false);
    }
}

let network = ''

let networkSaved = getNetworkStorage()

if (!networkSaved){
    network = Object.keys(configMixer.network)[0]
}else{
    network = networkSaved
}

let token = ''

let tokenSaved = getTokenStorage(network)

if (!tokenSaved){
    token = Object.keys(configMixer.network[network].token)[0]
}else{
    token = tokenSaved
}

//Config linked to the network
const configNetwork = configMixer.network[network]
const chainId = configNetwork.chainId
const supportedNetwork = configNetwork.supportedNetwork
const supportedNetworkName = configNetwork.supportedNetworkName
const blockExplorerTxPrefix = configNetwork.blockExplorerTxPrefix

//config for token
const configToken = configNetwork.token[token]
let tokenDecimals
let tokenSym
let mixAmt
let operatorFee
if (configToken){
    tokenDecimals = configToken.decimals
    tokenSym = configToken.sym
    mixAmt = configToken.mixAmt
    operatorFee = configToken.feeAmt
}
let isETH = true
if (tokenDecimals){
    isETH = false
}else{
    tokenDecimals = 18
}


//Config for frontend
const endsAtMidnight = configMixer.frontend.countdown.endsAtMidnight
const endsAfterSecs = configMixer.frontend.countdown.endsAfterSecs
const snarksPathsCircuit = configMixer.frontend.snarks.paths.circuit
const snarksPathsProvingKey = configMixer.frontend.snarks.paths.provingKey
const snarksPathsVerificationKey = configMixer.frontend.snarks.paths.verificationKey
const configEnv = configMixer.env


//config of deployed address contract network
const deployedAddressesNetwork = deployedAddresses[network]
let relayerRegistryAddress
let deployedAddressesToken
let mixerAddress
let tokenAddress
let semaphoreAddress
let forwarderRegistryERC20Address

if (deployedAddressesNetwork){
    relayerRegistryAddress = deployedAddressesNetwork.RelayerRegistry
    deployedAddressesToken = deployedAddressesNetwork.token[token]
    forwarderRegistryERC20Address = deployedAddressesNetwork.ForwarderRegistryERC20
    //config of deployed address contract token
    if (deployedAddressesToken){
        mixerAddress = deployedAddressesToken.Mixer
        tokenAddress = deployedAddressesToken.Token
        semaphoreAddress = deployedAddressesToken.Semaphore
    }
}

export {
    isETH,
    mixAmt,
    operatorFee,
    chainId,
    supportedNetwork,
    supportedNetworkName,
    relayerRegistryAddress,
    mixerAddress,
    tokenAddress,
    semaphoreAddress,
    forwarderRegistryERC20Address,
    blockExplorerTxPrefix,
    endsAtMidnight,
    endsAfterSecs,
    tokenDecimals,
    tokenSym,
    snarksPathsCircuit,
    snarksPathsProvingKey,
    snarksPathsVerificationKey,
    configEnv,
    setNetwork,
    setToken,
    network,
    token,
}
