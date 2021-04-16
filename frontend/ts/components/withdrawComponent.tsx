import React, { useState, useEffect } from 'react'
import ProgressBar from '../components/progressBar'
import { backendWithdraw } from '../web3/withdraw'
import {
    blockExplorerTxPrefix,
} from '../utils/configFrontend'

export default (props) => {
    const [txHash, setTxHash] = useState<String | undefined>()
    const [proofGenProgress, setProofGenProgress] = useState<{
        label:string|undefined,
        completed : number
    }>({
        label : undefined,
        completed : 0}
    )
    const [withdrawStarted, setWithdrawStarted] = useState(false)
    const [errorMsg, setErrorMsg] = useState<String | undefined>()

    console.log("WithdrawComponent redraw")

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
                            <a href={blockExplorerTxPrefix + txHash}
                                target="_blank">View on Etherscan.
                            </a>
                        :
                            txHash
                        }
                    </div>
                </article>
            }
            { errorMsg &&
                <article className="message is-danger">
                    <div className="message-body">
                        {'Error: ' + errorMsg}
                    </div>
                </article>
            }
        </div>
    )
}
