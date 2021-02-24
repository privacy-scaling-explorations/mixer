import * as ethers from 'ethers'

const getContract = (
    name: string,
    signer: ethers.Signer,
    deployedAddresses: string,
    abiName?: string
) => {
    if (!abiName) {
        abiName = name
    }

    const abi = require(`../compiled/abis/${abiName}-abi.json`)

    const contract = new ethers.Contract(
        deployedAddresses,
        abi,
        signer,
    )

    return contract
}

export { getContract }
