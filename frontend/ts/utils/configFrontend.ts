import * as ethers from 'ethers'

const configMixer = require('../../exported_config')
import { getDeployedAddresses } from 'mixer-contracts'

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
const supportedNetworkName = configNetwork.supportedNetworkName
const blockExplorerTxPrefix = configNetwork.blockExplorerTxPrefix

//config for token
const configToken = configNetwork.token[token]
let tokenDecimals
let tokenSym
let tokenName
let feeAmt
if (configToken){
    tokenDecimals = configToken.decimals
    tokenSym = configToken.sym
    tokenName = configToken.name
    feeAmt = configToken.feeAmt
}
let isETH = true
if (tokenDecimals){
    isETH = false
}else{
    tokenDecimals = 18
}


//Config for frontend
const endsAtMidnight = configMixer.frontend.countdown.endsAtUtcMidnight
const endsAfterSecs = configMixer.frontend.countdown.endsAfterSecs
const snarksPathsCircuit = configMixer.frontend.snarks.paths.circuit
const snarksPathsProvingKey = configMixer.frontend.snarks.paths.provingKey
const snarksPathsVerificationKey = configMixer.frontend.snarks.paths.verificationKey
const withdrawGas = configMixer.frontend.contract.withdrawGas
const configEnv = configMixer.env


//config of deployed address contract network
//const deployedAddresses = getDeployedAddresses(network)
const deployedAddressesNetwork = getDeployedAddresses(network)
console.log("deployedAddressesNetwork", getDeployedAddresses(network), deployedAddressesNetwork, network)
let relayerRegistryAddress
let deployedAddressesToken
let tokenAddress
let forwarderRegistryERC20Address
let mixerRegistryAddress

if (deployedAddressesNetwork){
    relayerRegistryAddress = deployedAddressesNetwork.RelayerRegistry
    deployedAddressesToken = deployedAddressesNetwork.token[token]
    forwarderRegistryERC20Address = deployedAddressesNetwork.ForwarderRegistryERC20
    mixerRegistryAddress = deployedAddressesNetwork.MixerRegistry
    //config of deployed address contract token
    if (deployedAddressesToken){
        tokenAddress = deployedAddressesToken.Token
    }
}

const getTokenConfig = (tokenAddress) => {
    if (deployedAddressesNetwork && deployedAddressesNetwork.token && configNetwork && configNetwork.token){
        for (let configTokenName of Object.keys(deployedAddressesNetwork.token)) {
            if (configNetwork.token[configTokenName]){
                if ((deployedAddressesNetwork.token[configTokenName] &&
                    deployedAddressesNetwork.token[configTokenName].Token == tokenAddress) ||
                    configNetwork.token[configTokenName].address == tokenAddress){
                    return configNetwork.token[configTokenName]
                } else if(tokenAddress == "0x0000000000000000000000000000000000000000" &&
                    !configNetwork.token[configTokenName].decimals){
                    return configNetwork.token[configTokenName]
                }
            }
        }
    }
}

const getTokenInfo = (tokenAddress) => {
    const tokenConfig = getTokenConfig(tokenAddress)
    const tokenSym = tokenConfig.sym
    const feeAmt = tokenConfig.feeAmt
    const isETH = tokenConfig.decimals ? false : true
    const tokenDecimals = tokenConfig.decimals ? tokenConfig.tokenDecimals : 18

    const feeAmtWei = ethers.utils.parseUnits(feeAmt.toString(), tokenDecimals)
    return {
        tokenSym,
        feeAmt,
        isETH,
        tokenDecimals,
        feeAmtWei,
    }
}



export {
    isETH,
    feeAmt,
    chainId,
    supportedNetworkName,
    relayerRegistryAddress,
    mixerRegistryAddress,
    tokenAddress,
    forwarderRegistryERC20Address,
    blockExplorerTxPrefix,
    endsAtMidnight,
    endsAfterSecs,
    tokenDecimals,
    tokenSym,
    tokenName,
    snarksPathsCircuit,
    snarksPathsProvingKey,
    snarksPathsVerificationKey,
    withdrawGas,
    configEnv,
    setNetwork,
    setToken,
    network,
    token,
    getTokenConfig,
    getTokenInfo,
}
