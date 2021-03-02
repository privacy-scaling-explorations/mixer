import React, { useState, useEffect, useContext } from 'react'
import ReactDOM from 'react-dom'
import { ethers } from 'ethers'

import { ConnectionContext, connectionConnect } from '../utils/connectionContext'


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

const WalletWidget = () => {

    const context =  useContext(ConnectionContext)

    connectionConnect(context)

    const provider : any = context.provider



    let signer

    const [address, setAddress] = useState(null)
    const [walletChainId, setWalletChainId] = useState(null)


    const connectWallet = () => {
        if (provider){
            try{
                signer = provider.getSigner()
            }catch (err){
                console.log(err)
            }
            if (signer){
                try{
                    signer.getChainId().then(
                        _chainId => {setWalletChainId(_chainId)
                    })
                }catch (err){
                    console.log(err)
                }
                try{
                    signer.getAddress().then(
                        _address => {setAddress(_address)
                    })
                }catch (err){
                    console.log(err)
                }   
            }
        }
    }

    connectWallet()

    console.log(provider, signer, address)

    const render = () => {



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
        } else if (provider && signer && address && walletChainId == chainId) {
            return (
                <p>
                    <span className='is-family-monospace address'>
                        { circleIcon('ok') }
                        { address }
                    </span>
                </p>
            )
        } else if (provider && signer && walletChainId) {
            return (
                <p>
                    { circleIcon('warn') }
                    Please connect to the {supportedNetworkName} testnet.
                </p>
            )
        } else {
            return (
                <p className='button is-link is-rounded'
                    role='button'
                    //TODO fix connect
                    onClick={() => {window.ethereum.enable().then(connectWallet())}} >
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
