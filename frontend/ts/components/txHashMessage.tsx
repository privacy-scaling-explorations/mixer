import React, { useState, Component } from 'react'
import ReactDOM from 'react-dom'
import { TxStatuses } from './txButton'

import{
    blockExplorerTxPrefix,
} from '../utils/configFrontend'

const TxHashMessage = ({
    txStatus,
    txHash,
    mixSuccessful,
}) => {
    let msg: string = ''
    let articleClass: string = ''

    if (mixSuccessful) {
        msg = 'Mix successful.'
        articleClass = 'is-success'
    } else if (txStatus === TxStatuses.Pending) {
        msg = 'Transaction pending.'
        articleClass = 'is-info'
    } else if (txStatus === TxStatuses.Mined) {
        msg = 'Transaction mined.'
        articleClass = 'is-success'
    }

    return (
        <article className={"message " + articleClass}>
            <div className="message-body">
                {msg}
                { blockExplorerTxPrefix ?
                     <a
                        href={blockExplorerTxPrefix + txHash}
                        target="_blank">View on Etherscan.
                    </a>
                :
                    txHash
            }
            </div>
        </article>
    )
}

export { TxHashMessage }
