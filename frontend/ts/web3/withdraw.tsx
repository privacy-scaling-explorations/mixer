import * as ethers from 'ethers'
import { SurrogethClient } from "surrogeth-client"
import {
    Mixer,
    ForwarderRegistryERC20,
} from './contract'

import {
    genDepositProof
} from './quickWithdraw'

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

        await progress('Downloading leaves...', 1)

        const leaves = await mixerContract.getLeaves()

        // TODO: serialise and deserialise the identity
        const pubKey = genPubKey(privKey)

        const identity: Identity = {
            keypair: { pubKey, privKey: privKey },
            identityNullifier: identityNullifier,
            identityTrapdoor: identityTrapdoor,
        }

        const identityCommitment = genIdentityCommitment(identity)

        await progress('Downloading circuit...', 10)
        const cirDef = await (await fetchWithoutCache(snarksPathsCircuit)).json()

        await progress('Generating circuit...', 20)
        const circuit = genCircuit(cirDef)

        await progress('Generating witness...', 30)
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

        await progress('Verify Signature...', 40)
        const validSig = verifySignature(result.msg, result.signature, pubKey)
        if (!validSig) {
            throw {
                code: ErrorCodes.INVALID_SIG,
            }
        }

        await progress('Verify Witness...', 50)
        if (!circuit.checkWitness(result.witness)) {
            throw {
                code: ErrorCodes.INVALID_WITNESS,
            }
        }

        await progress('Downloading proving key...', 55)
        const provingKey = Buffer.from(new Uint8Array(
            await (await fetch(snarksPathsProvingKey)).arrayBuffer())
        )

        await progress('Downloading verification key...', 60)
        const verifyingKey = parseVerifyingKeyJson(
            // @ts-ignore
            await (await fetch(snarksPathsVerificationKey)).text()
        )

        await progress('Generating proof...', 65)
        const proof = await genProof(result.witness, provingKey)

        await progress('Generating public signal...', 70)
        const publicSignals = genPublicSignals(result.witness, circuit)

        await progress('Verify proof...', 75)
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
    isETH,
    tokenDecimals,
    feeAmtWei,
    locator,
    locatorType,
) => {

    try {

        const progress = async (line: string, completed: number) => {
            console.info(line)
            setProgress({label:line, completed})
            //Let the time to redraw
            await sleep(10)
        }

        if (!provider){
            setErrorMsg('Provider not set')
            return
        }

        if (!locator){
            setErrorMsg('Broadcaster not set')
            return
        }

        console.log("withdraw locator", locator, locatorType)
        if (!locatorType){
            setErrorMsg('Broadcaster locatorType not set')
            return
        }

        const {
            recipientAddress,
            tokenAddress,
            mixerAddress,
        } = identityStored

        let tokenContract
        let recipientBalanceBefore
        if (isETH) {
            recipientBalanceBefore = await provider.getBalance(recipientAddress)
        } else {
            tokenContract = await getTokenContract(provider)
            recipientBalanceBefore = await tokenContract.balanceOf(recipientAddress)
        }

        const relayerAddress = forwarderRegistryERC20Address

        let withdrawProof = identityStored.withdrawProof
        let txHash

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

        if (locatorType == 'backend'){
            await progress('Calling backend server...', 90)
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

            await progress('Sending JSON-RPC call to the relayer...', 90)
            console.log("Backend request:", request.toString(), request)

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
                console.error(response)
                console.error(err)
            }
            if (responseJson && responseJson.result) {
                txHash = responseJson.result.txHash

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
        //Surrogeth
        } else {
            await progress('Calling Surrogeth agent...', 90)
            const depositProof = genDepositProof(
                signal,
                proof,
                publicSignals,
                recipientAddress,
                feeAmtWei,
            )
            const iface = new ethers.utils.Interface(Mixer.abi)
            const mixCallData = iface.encodeFunctionData(isETH?"mix": "mixERC20", [
        	    depositProof.signal,
        	    depositProof.a,
        	    depositProof.b,
        	    depositProof.c,
        	    depositProof.input,
        	    depositProof.recipientAddress,
        	    depositProof.fee,
        	    relayerAddress,
            ])

            const forwarderIface = new ethers.utils.Interface(ForwarderRegistryERC20.abi)
            let relayCallData
            if (tokenAddress){
                relayCallData = forwarderIface.encodeFunctionData("relayCallERC20",
                    [
                        mixerAddress,
                        mixCallData,
                        tokenAddress,
                    ],
                )
            }else{
                relayCallData = forwarderIface.encodeFunctionData("relayCall",
                    [
                        mixerAddress,
                        mixCallData
                    ],
                )
            }

            const protocol = "http"

            const client = new SurrogethClient(
                provider,
                network, // "KOVAN" || "MAINNET"
                relayerAddress, // defaults to current deployment on specified network
                ForwarderRegistryERC20.abi,
                protocol, // "https" || "http"
                tokenAddress
            )

            const tx = {
                to : relayerAddress,
                data : relayCallData,
                value: "0"
            }

            const relayer = {
                locator: locator,
                locatorType: locatorType
            }

            try {
                txHash = await client.submitTx(tx, relayer)
            } catch (error) {
                if (error.response){
                    console.log(error.response.data)
                } else {
                    console.log(error)
                }
                throw error
            }
        }

        await progress('Check balance...', 95)
        //await sleep(10000)
        let recipientBalanceAfter
        if (isETH) {
            recipientBalanceAfter = await provider.getBalance(recipientAddress)
            console.log('The recipient balance increased by ',
                ethers.utils.formatEther(
                    recipientBalanceAfter.sub(
                        recipientBalanceBefore)),
                'ETH',
                ethers.utils.formatEther(recipientBalanceAfter),
                ethers.utils.formatEther(recipientBalanceBefore),
            )
        } else {
            recipientBalanceAfter = await tokenContract.balanceOf(recipientAddress)
            console.log('The recipient balance increased by ',
                ethers.utils.formatUnits(
                    recipientBalanceAfter.sub(
                        recipientBalanceBefore
                    ), tokenDecimals), 'tokens')
        }

        if (txHash){
            updateWithdrawTxHash(identityStored, txHash)
            await progress('Completed', 100)
            console.log("json to serveur", txHash)
            setTxHash({txHash,
                balanceBefore: recipientBalanceBefore,
                balance: recipientBalanceAfter.sub(
                recipientBalanceBefore)})
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
