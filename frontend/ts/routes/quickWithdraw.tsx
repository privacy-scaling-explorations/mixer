import React, { Component, useState, useContext, useEffect } from 'react'
import ReactDOM from 'react-dom'
import * as ethers from 'ethers'
import { utils } from 'mixer-contracts'
import { sleep } from 'mixer-utils'

import { TxButton, TxStatuses } from '../components/txButton'
import { TxHashMessage } from '../components/txHashMessage'
import { quickWithdrawEth, quickWithdrawTokens } from '../web3/quickWithdraw'
import { getMixerContract } from '../web3/mixer'
import { fetchWithoutCache } from '../utils/fetcher'
import { ConnectionContext } from '../utils/connectionContext'

import{
    chainId,
    isETH,
    mixAmt,
    operatorFee,
    tokenDecimals,
    configEnv,
    blockExplorerTxPrefix,
    mixerAddress,
    snarksPathsCircuit,
    snarksPathsProvingKey,
    snarksPathsVerificationKey,
} from '../utils/configFrontend'

import {
    genCircuit,
    genMixerWitness,
    genPublicSignals,
    verifySignature,
    genPubKey,
    genProof,
    genIdentityCommitment,
    verifyProof,
    Identity,
    parseVerifyingKeyJson,
} from 'libsemaphore'

import { ErrorCodes } from '../errors'

import {
    getItems,
    updateWithdrawTxHash,
    getFirstUnwithdrawn,
    getNumUnwithdrawn,
} from '../storage'

const noItemsCol = (
    <div className='column is-8 is-offset-2'>
        <h2 className='subtitle'>
            Nothing to withdraw. To get started,
            please <a href='/'>make a deposit</a>.
        </h2>
    </div>
)

const noItems = (
    <div className='section'>
        <div className='columns has-text-centered'>
            {noItemsCol}
        </div>
    </div>
)

export default () => {
    if (getNumUnwithdrawn() === 0) {
        return noItems
    }

    const [proofGenProgress, setProofGenProgress] = useState('')
    const [pendingTxHash, setPendingTxHash] = useState('')
    const [completedWithdraw, setCompletedWithdraw] = useState(false)
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [consentChecked, setConsentChecked] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const context = useContext(ConnectionContext)
    console.log("context", context)
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

    let withdrawBtnDisabled = !consentChecked

    const progress = (line: string) => {
        setProofGenProgress(line)
    }

    // Just use the last stored item
    const identityStored = getFirstUnwithdrawn()

    const tokenType = identityStored.tokenType

    const feeAmt = operatorFee * (10 ** tokenDecimals)

    const withdrawTxHash = identityStored.withdrawTxHash
    const recipientAddress = identityStored.recipientAddress

    const handleWithdrawBtnClick = async () => {

        if (!consentChecked || ! context.provider || networkChainId != chainId) {
            return
        }

        try {
            const mixerContract = await getMixerContract(context.provider)

            const relayerAddress = address

            const externalNullifier = mixerContract.address

            progress('Downloading leaves...')

            const leaves = await mixerContract.getLeaves()

            const pubKey = genPubKey(identityStored.privKey)

            const identity: Identity = {
                keypair: { pubKey, privKey: identityStored.privKey },
                identityNullifier: identityStored.identityNullifier,
                identityTrapdoor: identityStored.identityTrapdoor,
            }

            const identityCommitment = genIdentityCommitment(identity)

            progress('Downloading circuit...')
            const cirDef = await (await fetchWithoutCache(snarksPathsCircuit)).json()
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

            const validSig = verifySignature(result.msg, result.signature, pubKey)
            if (!validSig) {
                throw {
                    code: ErrorCodes.INVALID_SIG,
                }
            }


            if (!circuit.checkWitness(result.witness)) {
                throw {
                    code: ErrorCodes.INVALID_WITNESS,
                }
            }

            progress('Downloading proving key...')

            const provingKey = Buffer.from(new Uint8Array(
                await (await fetch(snarksPathsProvingKey)).arrayBuffer())
            )

            progress('Downloading verifying key')

            const verifyingKey = parseVerifyingKeyJson(
                // @ts-ignore
                await (await fetch(snarksPathsVerificationKey)).text()
            )

            progress('Generating proof')
            const proof = await genProof(result.witness, provingKey)

            const publicSignals = genPublicSignals(result.witness, circuit)

            const isVerified = verifyProof(verifyingKey, proof, publicSignals)

            if (!isVerified) {
                throw {
                    code: ErrorCodes.INVALID_PROOF,
                }
            }

            progress('Performing transaction')

            let tx
            const quickWithdrawFunc = isETH ? quickWithdrawEth : quickWithdrawTokens
            tx = await quickWithdrawFunc(
                context.provider,
                result.signal,
                proof,
                publicSignals,
                recipientAddress,
                feeAmt.toString(),
                relayerAddress,
            )

            setPendingTxHash(tx.hash)
            setProofGenProgress('')

            const receipt = await tx.wait()

            if (configEnv === 'local-dev') {
                await sleep(2000)
            }

            if (receipt.status === 1) {
                setCompletedWithdraw(true)
                updateWithdrawTxHash(identityStored, tx.hash)
            } else {
                throw {
                    code: ErrorCodes.TX_FAILED,
                }
            }

        } catch (err) {
            console.error(err)
            setTxStatus(TxStatuses.Err)

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
            }

        }
    }

    return (
        <div className='section first-section'>
            <div className='columns has-text-centered'>
              { (!withdrawTxHash && !completedWithdraw) &&
                  <div className='column is-8 is-offset-2'>
                      <div className='section'>
                          <h2 className='subtitle'>
                              You can immediately withdraw { mixAmt - operatorFee} {tokenType} to
                              <br />
                              <br />
                              <pre>
                                  {recipientAddress}
                              </pre>
                          </h2>
                      </div>

                    <div className='section'>
                          <label className="checkbox">
                              <input
                                  onChange={() => {
                                      setConsentChecked(!consentChecked)
                                  }}
                                  type="checkbox" className="consent_checkbox" />
                              I understand that this transaction will not be
                              private as it will link your deposit address to
                              the receiver's address.
                         </label>

                          <br />
                          <br />

                          <TxButton
                              onClick={handleWithdrawBtnClick}
                              txStatus={txStatus}
                              isDisabled={withdrawBtnDisabled}
                              label={`Withdraw ${mixAmt - operatorFee} ${tokenType}`}
                          />

                          { pendingTxHash.length > 0 &&
                              <div>
                                  <br />
                                  <TxHashMessage
                                      mixSuccessful={false}
                                      txHash={pendingTxHash}
                                      txStatus={TxStatuses.Pending} />
                              </div>
                          }

                          <br />
                          <br />

                          { proofGenProgress.length > 0 &&
                              <div className="has-text-left">
                                  <br />
                                  <pre>
                                      {proofGenProgress}
                                  </pre>
                              </div>
                          }

                          <br />
                          <br />

                          { txStatus === TxStatuses.Err &&
                              <article className="message is-danger">
                                  <div className="message-body">
                                      {'Error: ' + errorMsg}
                                  </div>
                              </article>
                          }

                       </div>
                   </div>
               }

               { completedWithdraw &&
                    <div className='column is-8 is-offset-2'>
                        <TxHashMessage
                            mixSuccessful={true}
                            txHash={pendingTxHash}
                            txStatus={TxStatuses.Mined} />
                        <a href='/'>Make another deposit</a>.
                   </div>
               }

               { withdrawTxHash && !completedWithdraw &&
                   noItemsCol
               }
            </div>
        </div>
    )
}
