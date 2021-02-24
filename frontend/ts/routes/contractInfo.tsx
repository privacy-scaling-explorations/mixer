import React from 'react'
import ReactDOM from 'react-dom'

import{
    chainId,
    tokenAddress,
    relayerRegistryAddress,
    mixerAddress,
    semaphoreAddress,
} from '../utils/configFrontend'

const AboutRoute = () => {
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
        </div>
    </div>
)
}

export default AboutRoute
