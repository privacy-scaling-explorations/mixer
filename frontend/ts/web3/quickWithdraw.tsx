import * as ethers from 'ethers'
import { getRelayerRegistryContract, getMixerContract } from './mixer'

import{
    chainId,
    mixerAddress,
} from '../utils/configFrontend'

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
    context: any,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    broadcasterAddress,
) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(chainId),
        )
        const signer = provider.getSigner()
        const mixerContract = await getMixerContract(context)
        const relayerRegistryContract = await getRelayerRegistryContract(context)

        const depositProof = genDepositProof(
            signal,
            proof,
            publicSignals,
            recipientAddress,
            feeAmt,
        )

        const iface = new ethers.utils.Interface(mixerContract.interface.abi)
        const callData = iface.functions.mix.encode([
            depositProof.signal,
            depositProof.a,
            depositProof.b,
            depositProof.c,
            depositProof.input,
            depositProof.recipientAddress,
            depositProof.fee,
            broadcasterAddress])

        return relayerRegistryContract.relayCall(
            mixerAddress,
            callData,
            { gasLimit: 8000000 },
        )
    }
}

/*
 * Perform a web3 transaction to make quick withdrawal of tokens
 * @param context The web3-react context
 * @param identityCommitment A hex string of the user's identity commitment
 */
const quickWithdrawTokens = async (
    context: any,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    broadcasterAddress,
) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(chainId),
        )
        const signer = provider.getSigner()
        const mixerContract = await getMixerContract(context)
        const relayerRegistryContract = await getRelayerRegistryContract(context)

        const depositProof = genDepositProof(
            signal,
            proof,
            publicSignals,
            recipientAddress,
            feeAmt,
        )

        const iface = new ethers.utils.Interface(mixerContract.interface.abi)
        const callData = iface.functions.mixERC20.encode([
            depositProof.signal,
            depositProof.a,
            depositProof.b,
            depositProof.c,
            depositProof.input,
            depositProof.recipientAddress,
            depositProof.fee,
            broadcasterAddress])

        return relayerRegistryContract.relayCall(
            mixerAddress,
            callData,
            { gasLimit: 8000000 },
        )
    }
}

export { quickWithdrawEth, quickWithdrawTokens }
