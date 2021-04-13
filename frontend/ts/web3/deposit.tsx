import * as ethers from 'ethers'

import {
    getMixerContract,
    getTokenContract,
    Mixer,
} from './contract'

/*
 * Perform a web3 transaction to make a deposit
 * @param context The web3-react context
 * @param identityCommitment A hex string of the user's identity commitment
 * @param mixAmt The amount to mix
 */
const depositEth = async (
    signer: ethers.Signer,
    identityCommitment: string,
    mixAmt: ethers.BigNumber,
    mixerAddress: string
) => {

    const mixerContract = await getMixerContract(signer, mixerAddress)

    console.log("deposit:",mixAmt)
    const tx = await mixerContract.deposit(identityCommitment, { value: mixAmt})
    console.log("deposit ok")
    return tx
}

const depositTokens = async(
    signer: ethers.Signer,
    identityCommitment: string,
    mixerAddress: string
) => {

    const mixerContract = await getMixerContract(signer, mixerAddress)

    const tx = await mixerContract.depositERC20(identityCommitment)

    return tx


}

/*
 * Perform a web3 transaction to the ERC20 contract's approve function
 * @param context The web3-react context
 * @param numTokens The amount of tokens. This should be multiplied by 10 ^
 *                  token.decimals before passing it to this function.
 */
const approveTokens = async (
    signer: ethers.Signer,
    numTokens: ethers.BigNumber,
    mixerAddress: string
) => {
        const tokenContract = await getTokenContract(signer)

        const tx = await tokenContract.approve(mixerAddress, numTokens)

        return tx
    }

export { depositEth, depositTokens, approveTokens }
