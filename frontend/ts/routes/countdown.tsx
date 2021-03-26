import React, { Component, useState, useContext, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useTimer } from 'react-timer-hook'
import * as ethers from 'ethers'
import { Redirect } from 'react-router-dom'
import { getMixerContract, getTokenContract } from '../web3/mixer'
import { genMixParams, sleep } from 'mixer-utils'
import { fetchWithoutCache } from '../utils/fetcher'
import { ConnectionContext } from '../utils/connectionContext'
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
    getItems,
    getNumItems,
    updateWithdrawTxHash,
    getNumUnwithdrawn,
    getFirstUnwithdrawn,
} from '../storage'

import { ErrorCodes } from '../errors'

import {
    isETH,
    network,
    mixAmt,
    operatorFee,
    tokenDecimals,
    blockExplorerTxPrefix,
    endsAtMidnight,
    endsAfterSecs,
    mixerAddress,
    forwarderRegistryERC20Address,
    chainId,
    snarksPathsCircuit,
    snarksPathsProvingKey,
    snarksPathsVerificationKey,
} from '../utils/configFrontend'

import {
    getBackendStatus
} from '../utils/backend'

const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default () => {
    if (getNumUnwithdrawn() === 0) {
        return <Redirect to='/' />
    }

    const [txHash, setTxHash] = useState('')
    const [firstLoadTime, setFirstLoadTime] = useState(new Date())
    const [withdrawStarted, setWithdrawStarted] = useState(false)
    const [countdownDone, setCountdownDone] = useState(false)
    const [proofGenProgress, setProofGenProgress] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [withdrawBtnClicked, setWithdrawBtnClicked] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const progress = (line: string) => {
        console.log(line)
        setProofGenProgress(line)
    }

    const identityStored = getFirstUnwithdrawn()
    const recipientAddress = identityStored.recipientAddress

    const tokenType = identityStored.tokenType

    const feeAmt = operatorFee * (10 ** tokenDecimals)

    const context = useContext(ConnectionContext)
    const [networkChainId, setnetworkChainId] = useState(context.networkChainId)
    const [address, setAddress] = useState(context.address)
    const connectWallet = () => {
        setnetworkChainId(context.networkChainId)
        setAddress(context.address)
    }

    useEffect(() => {
        const interval = setInterval(() => connectWallet(), 1000)
        return () => clearInterval(interval)
    })

    const withdraw = async (provider) => {
        //TODO check chainId for context.provider

        let tokenContract

        if (isETH) {
            const recipientBalanceBefore = await provider.getBalance(recipientAddress)
        } else {
            tokenContract = await getTokenContract(provider)
            const recipientBalanceBefore = (await tokenContract.balanceOf(recipientAddress)) / (10 ** tokenDecimals)
        }

        const relayerAddress = forwarderRegistryERC20Address

        try {

            const mixerContract = await getMixerContract(provider)

            const externalNullifier = mixerContract.address

            //cache in local storage
            const localStorage = window.localStorage

            const cacheID = 'cacheParam.' + network + "." + mixerContract.address.slice(4).toLowerCase()

            let paramsStr = localStorage.getItem(cacheID)

            let params

            /*
            if (paramsStr){
                params = JSON.parse(paramsStr)
            }
            */

            if (!params){
                progress('Downloading leaves...')

                const leaves = await mixerContract.getLeaves()

                // TODO: serialise and deserialise the identity
                const pubKey = genPubKey(identityStored.privKey)

                const identity: Identity = {
                    keypair: { pubKey, privKey: identityStored.privKey },
                    identityNullifier: identityStored.identityNullifier,
                    identityTrapdoor: identityStored.identityTrapdoor,
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
                        feeAmt,
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

                params = genMixParams(
                    network,
                    mixerAddress,
                    result.signal,
                    proof,
                    recipientAddress,
                    feeAmt,
                    publicSignals,
                )

                localStorage.setItem(cacheID, JSON.stringify(params))

            }

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
            } else if (err.code === ErrorCodes.TX_FAILED) {
                setErrorMsg('The transaction failed.')
            } else if (err.code === ErrorCodes.PRE_BROADCAST_CHECK_FAILED) {
                setErrorMsg('The pre-broadcast check failed')
            }

        }
    }

    let expiryDate = new Date(identityStored.timestamp)
    expiryDate.setUTCHours(0, 0, 0, 0)
    expiryDate.setDate(expiryDate.getDate() + 1)

    // Whether the current time is greater than the expiry timestamp (i.e.
    // UTC midnight
    let midnightOver = firstLoadTime > expiryDate

    // Dev only
    if (!endsAtMidnight && !midnightOver) {
        expiryDate = new Date()
        expiryDate.setSeconds(
            expiryDate.getSeconds() + endsAfterSecs
        )
    }

    let expiryTimestamp =  expiryDate.getTime()

    const timeStr = `${expiryDate.getDate()} ${months[expiryDate.getMonth()]} ` +
        `${expiryDate.getFullYear()}, ${expiryDate.toLocaleTimeString()}`

    const timer = useTimer({
        expiryTimestamp,
        onExpire: () => {
            if (!countdownDone) {
                setCountdownDone(true)
            }
        }
    })

    if (!withdrawStarted &&
        countdownDone &&
        context.provider &&
        !midnightOver &&
        timer.days + timer.hours + timer.minutes + timer.seconds === 0
    ) {
        setWithdrawStarted(true)
    }

    const withdrawBtn = (
        <span
            onClick={() => {
                setWithdrawBtnClicked(true)
                if (showAdvanced) {
                    setShowAdvanced(false)
                }

                setWithdrawStarted(true)
                withdraw(context.provider)
            }}
            className='button is-warning'>
            Mix now
        </span>
    )

    return (
        <div className='section first-section'>
            <div className='columns has-text-centered'>
                <div className='column is-8 is-offset-2'>
                    <div className='section'>
                        <h2 className='subtitle'>
                            The address:
                            <br />
                            <br />
                            <pre>
                                {recipientAddress}
                            </pre>
                            <br />
                            can receive {mixAmt - operatorFee} {tokenType}
                            { countdownDone || midnightOver || withdrawBtnClicked ?
                                <span>
                                    { (txHash.length === 0 && midnightOver) ?
                                        <span>.</span>
                                        :
                                        <span>
                                            {' '}.
                                        </span>
                                    }
                                  { proofGenProgress.length > 0 &&
                                      <div className="has-text-left">
                                          <br />
                                          <pre>
                                              {proofGenProgress}
                                          </pre>
                                      </div>
                                  }
                                </span>
                                :
                                <span>
                                    {' '} shortly after { timeStr } local time.
                                </span>
                            }
                        </h2>

                        { networkChainId == chainId && txHash.length === 0 && (midnightOver || withdrawStarted) &&  !withdrawBtnClicked &&
                            withdrawBtn
                        }

                        { (networkChainId && networkChainId != chainId) &&
                            <p>
                                To continue, please connect to the correct Ethereum network.
                            </p>
                        }

                        { txHash.length > 0 &&
                            <article className="message is-success">
                                <div className="message-body">
                                    Mix successful. <a
                                        href={blockExplorerTxPrefix + txHash}
                                        target="_blank">View on Etherscan.
                                    </a>
                                </div>
                            </article>
                        }

                    </div>
                </div>

            </div>

            { errorMsg.length > 0 &&
                <article className="message is-danger">
                    <div className="message-body">
                        {'Error: ' + errorMsg}
                    </div>
                </article>
            }


            { !(txHash.length === 0 && midnightOver) &&
                <div className='columns'>
                    <div className='column is-6 is-offset-3'>
                        <p>
                            To enjoy the most anonymity, leave your deposit
                            untouched for as long as possible. We recommend
                            that you wait at least till past midnight UTC of
                            the day you deposit funds. For example, if you
                            deposit your funds at 3pm UTC on 1 Jan, this please
                            wait at least 9 hours to mix the funds.
                        </p>
                    </div>

                </div>
            }

            <br />

            { !(txHash.length === 0 && midnightOver) &&
                !withdrawBtnClicked &&
                !withdrawStarted &&
                <div>
                    <div className="columns has-text-centered">
                        <div className='column is-12'>
                                <h2 className='subtitle'>
                                    {timer.hours}h {timer.minutes}m {timer.seconds}s left
                                </h2>
                            <h2 className='subtitle'>
                                Please keep this tab open.
                            </h2>
                        </div>
                    </div>

                    <div className="columns has-text-centered">
                        <div className='column is-12'>
                            <p className='subtitle advanced' onClick={
                                () => {
                                    setShowAdvanced(!showAdvanced)
                                }
                            }>
                                Advanced options
                                <span
                                    className={
                                        showAdvanced ? "chevron-up" : "chevron-down"
                                    }>
                                </span>
                            </p>

                            { showAdvanced &&
                                <article className="message is-info">
                                    <div className="message-body">
                                        <p>
                                            If you'd like, you may request to
                                            mix your funds now. Note that if
                                            you so now, may not have as much
                                            anonymity than if you were to wait
                                            till after midnight UTC or later.
                                        </p>
                                    </div>

                                    {networkChainId == chainId && withdrawBtn}

                                    { (networkChainId && networkChainId != chainId) &&
                                        <p>
                                            To continue, please connect to the correct Ethereum network.
                                        </p>
                                    }

                                    <br />
                                    <br />
                                </article>
                            }
                        </div>
                    </div>
                </div>
            }
        </div>
    )
}
