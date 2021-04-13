import React, { Component, useState, useContext, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useTimer } from 'react-timer-hook'
import * as ethers from 'ethers'
import { Redirect } from 'react-router-dom'

import { backendWithdraw } from '../web3/withdraw'

import {
    Identity,
} from 'libsemaphore'

import {
    getNumUnwithdrawn,
    getFirstUnwithdrawn,
} from '../storage'

import {
    getTokenInfo,
    blockExplorerTxPrefix,
    endsAtMidnight,
    endsAfterSecs,
} from '../utils/configFrontend'

import MixerDeposit from '../components/mixerDeposit'

import ProgressBar from '../components/progressBar'

const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default (props) => {
    if (getNumUnwithdrawn() === 0) {
        return <Redirect to='/' />
    }

    const [txHash, setTxHash] = useState('')
    const [firstLoadTime, setFirstLoadTime] = useState(new Date())
    const [withdrawStarted, setWithdrawStarted] = useState(false)
    const [countdownDone, setCountdownDone] = useState(false)
    const [proofGenProgress, setProofGenProgress] = useState({label : '', completed : 0})
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [withdrawBtnClicked, setWithdrawBtnClicked] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const identityStored = getFirstUnwithdrawn()
    const {
        recipientAddress,
        tokenAddress,
        mixAmt,
    } = identityStored
    const {
        tokenSym,
        tokenDecimals,
        feeAmtWei,
    } = getTokenInfo(tokenAddress)
    const mixAmtWei = ethers.utils.parseUnits(mixAmt.toString(), tokenDecimals)

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
        props.provider &&
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
                backendWithdraw(props.provider, identityStored, setProofGenProgress, setTxHash, setErrorMsg)
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
                            can receive { ethers.utils.formatUnits(mixAmtWei.sub(feeAmtWei), tokenDecimals) } {tokenSym}
                            { countdownDone || midnightOver || withdrawBtnClicked ?
                                <span>
                                    { (txHash.length === 0 && midnightOver) ?
                                        <span>.</span>
                                        :
                                        <span>
                                            {' '}.
                                        </span>
                                    }
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
                                </span>
                                :
                                <span>
                                    {' '} shortly after { timeStr } local time.
                                </span>
                            }
                        </h2>
                        <MixerDeposit
                            mixerAddress={identityStored.mixerAddress}
                            provider={props.provider}
                            transactionHash={identityStored.depositTxHash}/>

                        { !props.error && txHash.length === 0 && (midnightOver || withdrawStarted) &&  !withdrawBtnClicked &&
                            withdrawBtn
                        }

                        { props.error &&
                            <p>
                                {props.error}
                            </p>
                        }

                        { txHash.length > 0 &&
                            <article className="message is-success">
                                <div className="message-body">
                                    Mix successful.
                                    { blockExplorerTxPrefix ?
                                        <a href={blockExplorerTxPrefix + txHash}
                                            target="_blank">View on Etherscan.
                                        </a>
                                    :
                                        txHash
                                    }
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

                                    { !props.error && withdrawBtn }

                                    { props.error &&
                                        <p>
                                            {props.error}
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
