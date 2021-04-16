import * as ethers from 'ethers'

import {
    getMixerList
} from './contract/mixerRegistry'

const getContract = (
    name: string,
    signer: ethers.Signer,
    deployedAddresses: string,
    abiName?: string
) => {
    if (!abiName) {
        abiName = name
    }

    const abi = require(`../compiled/${abiName}.json`).abi

    const contract = new ethers.Contract(
        deployedAddresses,
        abi,
        signer,
    )

    return contract
}

const getAbi = (
    abiName: string
) => {

    const abi = require(`../compiled/${abiName}.json`).abi

    return abi
}

let deployedAddresses
try {
    deployedAddresses = require('../deployedAddresses/*.json');
} catch (ex) {
    //console.log("Cant load deployedAddress cache", ex)
    deployedAddresses = {}
}

const getDeployedAddresses = (network:string) => {
    if (!deployedAddresses[network]){
        try {
            deployedAddresses = require('../deployedAddresses/' + network + '.json');
        } catch (ex) {
            //console.log("Cant load deployedAddress cache", ex)
            deployedAddresses = {}
        }
        return deployedAddresses
    }
    return deployedAddresses[network] ? deployedAddresses[network] : {}
}

export { getContract, getDeployedAddresses, deployedAddresses, getAbi, getMixerList }
