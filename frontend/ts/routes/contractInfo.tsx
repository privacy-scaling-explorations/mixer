import React, { useState, useEffect, useContext } from 'react'
import ReactDOM from 'react-dom'
import { ConnectionContext } from '../utils/connectionContext'

import{
    chainId,
    network,
    tokenAddress,
    mixerAddress,
    semaphoreAddress,
    forwarderRegistryERC20Address,
} from '../utils/configFrontend'

import {
    getBackendStatus
} from '../utils/backend'

import {
    getBroadcasterList
} from '../web3/surrogeth'

const AboutRoute = () => {

    const [relayerAddress, setRelayerAddress] = useState('Request...')
    const [broadcasterList, setBroadcasterList] = useState('Request...')

    let initBroadcasterList

    const context = useContext(ConnectionContext)

    const connectWallet = () => {
        if (!initBroadcasterList && context.signer)
        getBroadcasterList(context.signer, network, tokenAddress).then((result) => {
            //console.log(result)
            if (result){
                //{locator, locatorType, address}
                setBroadcasterList(result[0].address + " " + result[0].locator)
            }else{
                setBroadcasterList("error")
            }

        })

    }

    useEffect(() => {
        initBroadcasterList = false
        getBackendStatus(network).then((result) => {
            //console.log(result)
            setRelayerAddress(result.address)
        })
        const interval = setInterval(() => connectWallet(), 1000)
        return () => clearInterval(interval)
    })

    return (
        <div className='columns'>
            <div className='column is-12-mobile is-8-desktop is-offset-2-desktop'>
            <h2 className='subtitle'>
                Contract Info
            </h2>
            <p>
                Chain Id : {chainId}
            </p>
            <p>
                Mixer Address : {mixerAddress}
            </p>
            <p>
                Semaphore Address : {semaphoreAddress}
            </p>
            <p>
                Token Address : {tokenAddress}
            </p>
            <p>
                Relayer Address : {relayerAddress}
            </p>
            <p>
                forwarderRegistryERC20 Address : {forwarderRegistryERC20Address}
            </p>
            <p>
                broadcaster Address : {broadcasterList}
            </p>
        </div>
    </div>
)
}

export default AboutRoute
