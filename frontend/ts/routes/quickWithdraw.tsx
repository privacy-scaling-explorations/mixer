import React, { useState} from 'react'
import * as ethers from 'ethers'
import { sleep } from 'mixer-utils'

import { TxButton, TxStatuses } from '../components/txButton'
import { TxHashMessage } from '../components/txHashMessage'
import {
    quickWithdrawEth,
    quickWithdrawTokens
} from '../web3/quickWithdraw'
import { getMixerContract } from '../web3/contract'
import { fetchWithoutCache } from '../utils/fetcher'
import { generateProof } from  '../web3/withdraw'

import{
    getTokenInfo,
    configEnv,
    blockExplorerTxPrefix,
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

import ProgressBar from '../components/progressBar'

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

export default (props) => {
    if (getNumUnwithdrawn() === 0) {
        return noItems
    }

    const [proofGenProgress, setProofGenProgress] = useState({label : '', completed : 0})
    const [pendingTxHash, setPendingTxHash] = useState('')
    const [completedWithdraw, setCompletedWithdraw] = useState(false)
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [consentChecked, setConsentChecked] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')


    let withdrawBtnDisabled = !consentChecked

    const progress = (line: string, completed: number) => {
        if (line) console.info(line)
        setProofGenProgress({label: line, completed})
    }

    // Just use the last stored item
    const identityStored = getFirstUnwithdrawn()
    const {
        recipientAddress,
        tokenAddress,
        mixAmt,
        mixerAddress,
        withdrawTxHash,
    } = identityStored

    const {
        tokenSym,
        feeAmt,
        isETH,
        tokenDecimals,
        feeAmtWei,
    } = getTokenInfo(tokenAddress)
    const mixAmtWei = ethers.utils.parseUnits(mixAmt.toString(), tokenDecimals)
    const withdrawAmt = ethers.utils.formatUnits(mixAmtWei.sub(feeAmtWei), tokenDecimals)

    const handleWithdrawBtnClick = async () => {

        if (!consentChecked || ! props.signer || props.error) {
            return
        }

        try {

            const {
                signal,
                publicSignals,
                proof,
            } = await generateProof(
                props.signer,
                mixerAddress,
                identityStored.privKey,
                identityStored.identityNullifier,
                identityStored.identityTrapdoor,
                recipientAddress,
                props.address,
                feeAmtWei,
                progress,
                setErrorMsg,
            )

            progress('Performing transaction, you should validate it now on metamask', 90)

            let tx
            const quickWithdrawFunc = isETH ? quickWithdrawEth : quickWithdrawTokens
            tx = await quickWithdrawFunc(
                props.signer,
                signal,
                proof,
                publicSignals,
                recipientAddress,
                feeAmtWei.toString(),
                props.address,
                mixerAddress,
            )

            setPendingTxHash(tx.hash)
            progress('', 100)

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

            if (err.code === ErrorCodes.TX_FAILED) {
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
                              You can immediately withdraw { withdrawAmt } {tokenSym} to
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
                              label={`Withdraw ${withdrawAmt} ${tokenSym}`}
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

                          { proofGenProgress.label.length > 0 &&
                              <div className="has-text-left">
                                  <br />
                                  <pre>
                                      {proofGenProgress.label}
                                  </pre>
                              </div>
                          }
                          { proofGenProgress.completed > 0 &&
                              <ProgressBar
                                completed={proofGenProgress.completed}/>
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
