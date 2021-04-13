import * as ethers from 'ethers'

import {
    genCircuit,
    genMixerWitness,
    genPublicSignals,
    verifySignature,
    genProof,
    genPubKey,
    genIdentityCommitment,
    verifyProof,
    Identity,
    parseVerifyingKeyJson,
} from 'libsemaphore'

import {
    genMixParams,
    sleep
} from 'mixer-utils'

import {
    getTokenConfig,
    getTokenInfo,
    network,
    forwarderRegistryERC20Address,
    snarksPathsCircuit,
    snarksPathsProvingKey,
    snarksPathsVerificationKey,

} from '../utils/configFrontend'

import {
    fetchWithoutCache
} from '../utils/fetcher'

import {
    getMixerContract,
    getTokenContract
} from '../web3/contract'

import {
    updateWithdrawTxHash,
} from '../storage'

import {
    ErrorCodes
} from '../errors'

const generateProof = async (
    provider,
    mixerAddress,
    privKey,
    identityNullifier,
    identityTrapdoor,
    recipientAddress,
    relayerAddress,
    feeAmtWei,
    progress,
    setErrorMsg,
) => {

    try {
        const mixerContract = await getMixerContract(provider, mixerAddress)

        const externalNullifier = mixerContract.address

        progress('Downloading leaves...')

        const leaves = await mixerContract.getLeaves()

        // TODO: serialise and deserialise the identity
        const pubKey = genPubKey(privKey)

        const identity: Identity = {
            keypair: { pubKey, privKey: privKey },
            identityNullifier: identityNullifier,
            identityTrapdoor: identityTrapdoor,
        }

        const identityCommitment = genIdentityCommitment(identity)

        progress('Downloading circuit...')
        const cirDef = await (await fetchWithoutCache(snarksPathsCircuit)).json()

        progress('Generating circuit...')
        const circuit = genCircuit(cirDef)

        progress('Generating witness...')
        let result
        try {
            result = await genMixerWitness(
                circuit,
                identity,
                leaves,
                20,
                recipientAddress,
                relayerAddress,
                feeAmtWei,
                externalNullifier,
            )

        } catch (err) {
            console.error(err)
            throw {
                code: ErrorCodes.WITNESS_GEN_ERROR,
            }
        }

        progress('Verify Signature...')
        const validSig = verifySignature(result.msg, result.signature, pubKey)
        if (!validSig) {
            throw {
                code: ErrorCodes.INVALID_SIG,
            }
        }

        progress('Verify Witness...')
        if (!circuit.checkWitness(result.witness)) {
            throw {
                code: ErrorCodes.INVALID_WITNESS,
            }
        }

        progress('Downloading proving key...')
        const provingKey = Buffer.from(new Uint8Array(
            await (await fetch(snarksPathsProvingKey)).arrayBuffer())
        )

        progress('Downloading verification key...')
        const verifyingKey = parseVerifyingKeyJson(
            // @ts-ignore
            await (await fetch(snarksPathsVerificationKey)).text()
        )

        progress('Generating proof...')
        const proof = await genProof(result.witness, provingKey)

        progress('Generating public signal...')
        const publicSignals = genPublicSignals(result.witness, circuit)

        progress('Verify proof...')
        const isVerified = verifyProof(verifyingKey, proof, publicSignals)

        if (!isVerified) {
            throw {
                code: ErrorCodes.INVALID_PROOF,
            }
        }

        return {
            signal: result.signal,
            publicSignals,
            proof,
        }
    } catch (err) {
        console.error(err)
        if (
            err.code === ethers.errors.UNSUPPORTED_OPERATION &&
            err.reason === 'contract not deployed'
        ) {
            setErrorMsg(`The mixer contract was not deployed to the expected address ${mixerAddress}`)
        } else if (err.code === ErrorCodes.WITNESS_GEN_ERROR) {
            setErrorMsg('Could not generate witness.')
        } else if (err.code === ErrorCodes.INVALID_WITNESS) {
            setErrorMsg('Invalid witness.')
        } else if (err.code === ErrorCodes.INVALID_PROOF) {
            setErrorMsg('Invalid proof.')
        } else if (err.code === ErrorCodes.INVALID_SIG) {
            setErrorMsg('Invalid signature.')
        } else {
            setErrorMsg(err.toString())
        }
    }
    return {
        signal: undefined,
        publicSignals: undefined,
        proof: undefined,
    }

}

const backendWithdraw = async (
    provider,
    identityStored,
    setProgress,
    setTxHash,
    setErrorMsg,
) => {

    const progress = (line: string) => {
        console.log(line)
        setProgress(line)
    }

    console.log("withdraw start")

    if (!provider){
        setErrorMsg('Provider not set')
        return
    }

    const {
        recipientAddress,
        tokenAddress,
        mixerAddress,
    } = identityStored

    const {
        isETH,
        tokenDecimals,
        feeAmtWei,
    } = getTokenInfo(tokenAddress)

    let tokenContract

    if (isETH) {
        const recipientBalanceBefore = await provider.getBalance(recipientAddress)
    } else {
        tokenContract = await getTokenContract(provider)
        const recipientBalanceBefore = (await tokenContract.balanceOf(recipientAddress)) / (10 ** tokenDecimals)
    }

    const relayerAddress = forwarderRegistryERC20Address

    try {

        const {
            signal,
            publicSignals,
            proof,
        } = await generateProof(
            provider,
            mixerAddress,
            identityStored.privKey,
            identityStored.identityNullifier,
            identityStored.identityTrapdoor,
            recipientAddress,
            relayerAddress,
            feeAmtWei,
            progress,
            setErrorMsg,
        )

        const params = genMixParams(
                network,
                mixerAddress,
                signal,
                proof,
                recipientAddress,
                feeAmtWei,
                publicSignals,
            )

        console.log(params)

        const method = isETH ? 'mixer_mix_eth' : 'mixer_mix_tokens'

        const request = {
            jsonrpc: '2.0',
            id: (new Date()).getTime(),
            method,
            params,
        }

        progress('Sending JSON-RPC call to the relayer...')
        //console.log("request:", request.toString(), request)

        const response = await fetch(
            '/api',
            {
                method: 'POST',
                body: JSON.stringify(request),
                headers: {
                    'Content-Type': 'application/json',
                }
            },
        )

        let responseJson
        try{
            responseJson = await response.json()
        }catch(err){
            console.error(err)
        }
        if (responseJson && responseJson.result) {
            progress('')
            setTxHash(responseJson.result.txHash)
            console.log("json to serveur", responseJson.result.txHash)
            updateWithdrawTxHash(identityStored, responseJson.result.txHash)

            //await sleep(4000)

            if (isETH) {
                const recipientBalanceAfter = await provider.getBalance(recipientAddress)
                console.log('The recipient now has', ethers.utils.formatEther(recipientBalanceAfter), 'ETH')
            } else {
                const recipientBalanceAfter = (await tokenContract.balanceOf(recipientAddress)) / (10 ** tokenDecimals)
                console.log('The recipient now has', recipientBalanceAfter.toString(), 'tokens')
            }

        } else if (responseJson && responseJson.error && responseJson.error.data && responseJson.error.data.name === 'BACKEND_MIX_PROOF_PRE_BROADCAST_INVALID') {
            throw {
                code: ErrorCodes.PRE_BROADCAST_CHECK_FAILED
            }
        } else if (responseJson && responseJson.error && responseJson.error.code && responseJson.error.message){
            console.log(responseJson.error)
            setErrorMsg('Server error : ' + responseJson.error.code + ' : ' + responseJson.error.message)
        } else {
            console.log(response)
            setErrorMsg('Server error')
        }
    } catch (err) {
        console.log(err)

        if (err.code === ErrorCodes.TX_FAILED) {
            setErrorMsg('The transaction failed.')
        } else if (err.code === ErrorCodes.PRE_BROADCAST_CHECK_FAILED) {
            setErrorMsg('The pre-broadcast check failed')
        } else {
            setErrorMsg(err.toString())
        }


    }
}

export {
    backendWithdraw,
    generateProof,
}
