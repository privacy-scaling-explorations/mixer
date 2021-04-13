import * as ethers from 'ethers'
import {
    getForwarderRegistryERC20Contract,
    getMixerContract,
    Mixer
} from './contract'

const genDepositProof = (
    signal,
    proof,
    publicSignals,
    recipientAddress,
    fee,
) => {
    return {
        signal,
        a: [ proof.pi_a[0].toString(), proof.pi_a[1].toString() ],
        b: [
            [ proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString() ],
            [ proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString() ],
        ],
        c: [ proof.pi_c[0].toString(), proof.pi_c[1].toString() ],
        input: publicSignals.map((x) => x.toString()),
        recipientAddress,
        fee,
    }
}

/*
 * Perform a web3 transaction to make quick withdrawal of ETH
 * @param context The web3-react context
 * @param identityCommitment A hex string of the user's identity commitment
 */
const quickWithdrawEth = async (
    signer: ethers.Signer,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    broadcasterAddress,
    mixerAddress,
) => {

    const mixerContract = await getMixerContract(signer, mixerAddress)
    const forwarderRegistryERC20Contract = await getForwarderRegistryERC20Contract(signer)

    const depositProof = genDepositProof(
        signal,
        proof,
        publicSignals,
        recipientAddress,
        feeAmt,
    )

    const iface = new ethers.utils.Interface(Mixer.abi)
    const callData = iface.encodeFunctionData("mix", [
        depositProof.signal,
        depositProof.a,
        depositProof.b,
        depositProof.c,
        depositProof.input,
        depositProof.recipientAddress,
        depositProof.fee,
        broadcasterAddress])

    return forwarderRegistryERC20Contract.relayCall(
        mixerAddress,
        callData,
    )

}

/*
 * Perform a web3 transaction to make quick withdrawal of tokens
 * @param context The web3-react context
 * @param identityCommitment A hex string of the user's identity commitment
 */
const quickWithdrawTokens = async (
    signer: ethers.Signer,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    broadcasterAddress,
    mixerAddress,
) => {

    const mixerContract = await getMixerContract(signer, mixerAddress)
    const forwarderRegistryERC20Contract = await getForwarderRegistryERC20Contract(signer)

    const depositProof = genDepositProof(
        signal,
        proof,
        publicSignals,
        recipientAddress,
        feeAmt,
    )

    const iface = new ethers.utils.Interface(Mixer.abi)
    const callData = iface.encodeFunctionData("mixERC20", [
        depositProof.signal,
        depositProof.a,
        depositProof.b,
        depositProof.c,
        depositProof.input,
        depositProof.recipientAddress,
        depositProof.fee,
        broadcasterAddress])

    return forwarderRegistryERC20Contract.relayCallERC20(
        mixerAddress,
        callData,
    )

}

export { quickWithdrawEth, quickWithdrawTokens }
