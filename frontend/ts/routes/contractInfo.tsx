import React, { useState, useEffect, useContext } from 'react'
import ReactDOM from 'react-dom'

import{
    chainId,
    network,
    tokenAddress,
    relayerRegistryAddress,
    mixerAddress,
    semaphoreAddress,
} from '../utils/configFrontend'

import {
    getBackendStatus
} from '../utils/backend'

const AboutRoute = () => {

    const [relayerAddress, setRelayerAddress] = useState('Request...')

    useEffect(() => {
        getBackendStatus(network).then((result) => {
            //console.log(result)
            setRelayerAddress(result.address)
        })
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
                Relayer Registry Address : {relayerRegistryAddress}
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
        </div>
    </div>
)
}

export default AboutRoute
