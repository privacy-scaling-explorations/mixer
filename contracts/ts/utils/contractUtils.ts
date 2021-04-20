import { ethers } from 'ethers'
import { getDeployedAddresses } from '../index'


const getContractNetwork = async (
    name: string,
    signer: ethers.Signer,
    network : string,
    contractAddresses?: string,
    abiName?: string
) => {

    if (!contractAddresses && network) {
        contractAddresses = getDeployedAddresses(network)[name]
    }

    if (!contractAddresses){
        throw "error getting contract address " + name
    }

    if (!abiName) {
        abiName = name
    }

    const abi = require(`../../compiled/${abiName}.json`).abi

    const contract = new ethers.Contract(
        contractAddresses,
        abi,
        signer,
    )
    return contract
}

const getMixerRegistryContract = async (
    signer: ethers.Signer,
    network : string,
    contractAddresses?: string,
) => {
    return await getContractNetwork(
        "MixerRegistry",
        signer,
        network,
        contractAddresses,
    )
}

const getMixerContract = async (
    signer: ethers.Signer,
    contractAddresses: string,
    network : string
) => {
    return await getContractNetwork(
        "Mixer",
        signer,
        network,
        contractAddresses,
    )
}

const getSemaphoreContract = async (
    signer: ethers.Signer,
    contractAddresses: string,
    network : string
) => {
    return await getContractNetwork(
        "Semaphore",
        signer,
        network,
        contractAddresses,
    )
}

export {
    getMixerRegistryContract,
    getMixerContract,
    getSemaphoreContract,
}
