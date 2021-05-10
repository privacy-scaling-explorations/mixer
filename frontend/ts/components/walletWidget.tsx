import React, { useState, useEffect, useContext } from 'react'
import ReactDOM from 'react-dom'
import { ethers } from 'ethers'

import{
    chainId,
    blockExplorerTxPrefix,
    supportedNetworkName,
} from '../utils/configFrontend'

const walletLearnUrl = 'https://ethereum.org/use/#_3-what-is-a-wallet' +
    '-and-which-one-should-i-use'

// From Font Awesome
const circleIcon = (className: string) => (
    <svg viewBox='0 0 512 512' className={'circle-icon ' + className}>
        <path d='M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z'/>
    </svg>
)

const WalletWidget = (props) => {

    const render = () => {

        //console.log("Wallet Render " , address, networkChainId)

        if (!window.hasOwnProperty('ethereum')) {
            return (
                <p>
                    { circleIcon('fail') }
                    Please install an <a
                        href={walletLearnUrl} target='blank'>
                        Ethereum wallet.
                    </a>
                </p>
            )
        } else if (!props.error && props.address == "error") {
            console.log("here")
            return (
                <p className='button is-link is-rounded'
                    role='button'
                    //TODO fix connect
                    onClick={() => {window.ethereum.enable().then()}} >
                    Connect wallet
                </p>
            )
        } else if (!props.error) {
            return (
                <p>
                    <span className='is-family-monospace address'>
                        { circleIcon('ok') }
                        { props.address }
                    </span>
                </p>
            )
        } else if (props.error) {
            return (
                <p>
                    { circleIcon('warn') }
                    { props.error }
                </p>
            )
        } else {
            return (
                <p className='button is-link is-rounded'
                    role='button'
                    //TODO fix connect
                    onClick={() => {window.ethereum.enable().then()}} >
                    Connect wallet
                </p>
            )
        }
    }

    return (
        <div id='wallet-widget'>
            {render()}
        </div>
    )
}


export default WalletWidget
