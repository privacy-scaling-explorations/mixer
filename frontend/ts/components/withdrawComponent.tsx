import React, { useState, useEffect } from 'react'
import ProgressBar from '../components/progressBar'
import * as ethers from 'ethers'
import { backendWithdraw } from '../web3/withdraw'
import {
    blockExplorerTxPrefix,
} from '../utils/configFrontend'
import {
    updateWithdrawTxHash,
} from '../storage'
import BalanceComponent from '../components/balanceComponent'

const WithdrawComponent = (props) => {
    const [txHash, setTxHash] = useState<{
        txHash:String,
        balance:ethers.BigNumber,
        balanceBefore:ethers.BigNumber
    } | undefined>()
    const [proofGenProgress, setProofGenProgress] = useState<{
        label:string|undefined,
        completed : number
    }>({
        label : undefined,
        completed : 0}
    )
    const [withdrawStarted, setWithdrawStarted] = useState(false)
    const [errorMsg, setErrorMsg] = useState<String | undefined>()

    return(
        <div>
            { props.error &&
                <div><p>
                    {props.error}
                </p></div>
            }
            { withdrawStarted && proofGenProgress.label &&
                <div className="has-text-left">
                    <br />
                    <pre>
                        {proofGenProgress.label}
                    </pre>
                </div>
            }
            { withdrawStarted && proofGenProgress.completed > 0 &&
                <ProgressBar
                  completed={proofGenProgress.completed}/>
            }
            { props.surrogethInfo && !props.error && !txHash && !withdrawStarted &&
                <div style={{paddingTop:"1em", paddingBottom:"1em"}}>
                <span
                    onClick={() => {
                        setWithdrawStarted(true)
                        props.setWithdrawStarted(true)
                        backendWithdraw(
                            props.provider,
                            props.identityStored,
                            setProofGenProgress,
                            setTxHash,
                            setErrorMsg,
                            props.isETH,
                            props.tokenDecimals,
                            props.surrogethInfo.fee,
                            props.surrogethInfo.locator,
                            props.surrogethInfo.locatorType,
                        )
                    }}
                    className='button is-warning'>
                    Mix now
                </span>
                </div>
            }

            { txHash &&
                <article className="message is-success">
                    <div className="message-body">
                        Mix successful.
                        { blockExplorerTxPrefix ?
                            <a href={blockExplorerTxPrefix + txHash.txHash}
                                target="_blank">View on Etherscan.
                            </a>
                        :
                            txHash.txHash
                        }
                    </div>
                    <BalanceComponent
                        provider={props.provider}
                        txHash={txHash}
                        tokenDecimals={props.tokenDecimals}
                        tokenSym={props.tokenSym}
                        tokenAddress={props.identityStored.tokenAddress}
                        recipientAddress={props.identityStored.recipientAddress}
                        />
                    <div className="message-body">
                        <a href='/'>Make another deposit</a>.
                    </div>
                </article>
            }
            { errorMsg &&
                <article className="message is-danger">
                    <div className="message-body">
                    <div>
                        {'Error: ' + errorMsg}<br/><br/>
                    </div>
                    <div>
                    <div>
                    <span
                        onClick={() => {
                            window.location.reload()
                        }}
                        className='button is-warning'>
                        Retry<br/><br/>
                    </span>
                    </div>
                    <span
                        onClick={() => {
                            updateWithdrawTxHash(props.identityStored, "0x0")
                            window.location.reload()
                        }}
                        className='button is-warning'>
                        Forget about this proof
                    </span>
                    </div>
                    </div>
                </article>
            }
        </div>
    )
}

export default WithdrawComponent
