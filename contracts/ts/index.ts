import * as ethers from 'ethers'

let deployedAddresses
try{
    deployedAddresses = require('../deployedAddresses')
}catch (ex){
    deployedAddresses = {}
}


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


export { getContract, deployedAddresses, getAbi }
