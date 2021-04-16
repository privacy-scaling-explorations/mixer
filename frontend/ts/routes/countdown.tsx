import React, { useState, useEffect } from 'react'
import * as ethers from 'ethers'
import { Redirect } from 'react-router-dom'

import {
    Identity,
} from 'libsemaphore'

import {
    getNumUnwithdrawn,
    getFirstUnwithdrawn,
} from '../storage'

import {
    getTokenInfo,
} from '../utils/configFrontend'

import MixerDeposit from '../components/mixerDeposit'
import SurrogethSelect from '../components/surrogethSelect'
import TimerComponent from '../components/timerComponent'

import WithdrawComponent from '../components/withdrawComponent'

export default (props) => {
    if (getNumUnwithdrawn() === 0) {
        return <Redirect to='/' />
    }

    const [withdrawStarted, setWithdrawStarted] = useState(false)
    const [withdrawEnable, setwithdrawEnable] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false)


    const [surrogethInfo, setSurrogethInfo] = useState<{
        feeCount : ethers.BigNumber,
        feeSum : ethers.BigNumber,
        fee : ethers.BigNumber,
        address : string,
        locator : string,
        locatorType : string}>()

    const identityStored = getFirstUnwithdrawn()
    const {
        recipientAddress,
        tokenAddress,
        mixAmt,
        timestamp,
    } = identityStored
    const {
        isETH,
        tokenSym,
        tokenDecimals,
        feeAmtWei
    } = getTokenInfo(tokenAddress)
    const mixAmtWei = ethers.utils.parseUnits(mixAmt.toString(), tokenDecimals)

    const broadcasterFeeAmtWei = surrogethInfo ?
        surrogethInfo.fee :
        ethers.BigNumber.from(0)

    if (!withdrawEnable){
        //setwithdrawEnable(true)
    }

    const withdrawChild = () => {
        if (identityStored && props.provider){
            return (
                <div>
                    {!withdrawStarted &&
                    <div><div>Chose your broadcaster : (Address and fee)</div>
                    <div>
                        <SurrogethSelect
                            provider={props.provider}
                            tokenAddress={tokenAddress}
                            tokenDecimals={tokenDecimals}
                            tokenSym={tokenSym}
                            feeAmtWei={feeAmtWei}
                            setSurrogethInfo={setSurrogethInfo}/>
                    </div></div>
                    }
                    {withdrawStarted && surrogethInfo &&
                        <div>
                        Broadcaster : {surrogethInfo.locatorType}&nbsp;
                        {surrogethInfo.locator}&nbsp;
                        ---&nbsp;
                        {ethers.utils.formatUnits(
                            surrogethInfo.fee,
                            tokenDecimals)}&nbsp;
                        {tokenSym}
                        </div>
                    }
                    {surrogethInfo && surrogethInfo.fee &&
                        <WithdrawComponent
                            provider={props.provider}
                            identityStored={identityStored}
                            isETH={isETH}
                            tokenDecimals={tokenDecimals}
                            surrogethInfo={surrogethInfo}
                            setWithdrawStarted={setWithdrawStarted}
                            />
                    }
                </div>
            )
        }
        return undefined
    }

    console.log("Cutdown redraw")
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
                            can receive&nbsp;
                            { ethers.utils.formatUnits(
                                mixAmtWei.sub(broadcasterFeeAmtWei),
                                tokenDecimals) }&nbsp;{tokenSym}.
                        </h2>
                    </div>

                    { !withdrawEnable &&
                        <div>
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
                            <TimerComponent timestamp={identityStored.timestamp} />
                        </div>
                    }

                    {!withdrawStarted &&
                        <div>
                        <MixerDeposit
                            mixerAddress={identityStored.mixerAddress}
                            provider={props.provider}
                            transactionHash={identityStored.depositTxHash}/>

                        </div>
                    }

                    {withdrawEnable &&
                        withdrawChild()
                    }

                    { !withdrawEnable &&
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

                                    <span
                                        onClick={() => {
                                            setwithdrawEnable(true)
                                        }}
                                        className='button is-warning'>
                                        I Agree
                                    </span>
                                </article>
                            }
                        </div>
                    </div>
                    }
                </div>

            </div>


        </div>
    )
}
