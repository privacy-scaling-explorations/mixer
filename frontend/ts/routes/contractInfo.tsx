import React, { useState, useEffect, useContext } from 'react'
import ReactDOM from 'react-dom'
import { ConnectionContext } from '../utils/connectionContext'

import{
    chainId,
    network,
    tokenAddress,
    tokenDecimals,
    tokenSym,
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
    const [broadcasterList, setBroadcasterList] = useState(["Request..."])

    let initBroadcasterList

    const context = useContext(ConnectionContext)

    const connectWallet = (interval) => {
        if (!initBroadcasterList && context.signer)
        getBroadcasterList(context.signer, network, tokenAddress, tokenDecimals).then((result) => {
            //console.log(JSON.stringify(result), JSON.stringify(broadcasterList))
            if (result && JSON.stringify(result) !== JSON.stringify(broadcasterList)){
                //{locator, locatorType, address}
                //setBroadcasterList(result[0].address + " " + result[0].locator)
                setBroadcasterList(result)
            }else if (!result){
                setBroadcasterList(["error"])
            }else{
                //Stop check each second for server load
                clearInterval(interval)
            }

        })

    }

    useEffect(() => {
        initBroadcasterList = false
        getBackendStatus(network).then((result) => {
            //console.log(result)
            setRelayerAddress(result.address)
        })
        const interval = setInterval(() => connectWallet(interval), 1000)
        return () => clearInterval(interval)
    })

    //console.log("Draw Contract info")

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
                ForwarderRegistryERC20 Address : {forwarderRegistryERC20Address}
            </p>

                Broadcaster : <br/>
                <table style={{marginLeft: "0em"}}>
                    <thead>
                        <tr>
                            <td style={
                                {textAlign: "center", padding: '0 1em 0 1em'}
                            }>IP</td>
                            <td style={
                                {textAlign: "center", padding: '0 1em 0 1em'}
                            }>Address</td>
                            <td style={
                                {textAlign: "center", padding: '0 1em 0 1em'}
                            }>Transaction</td>
                            <td style={
                                {textAlign: "center", padding: '0 1em 0 1em'}
                            }>Average fee</td>
                        </tr>
                    </thead>
                    <tbody>
                    {broadcasterList.map((obj:any) => {
                        if (typeof obj === 'string' || obj instanceof String){
                            return (<tr key="msg">
                                <td>{obj}</td>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>)
                        }else{
                            return (
                                //The address is unique
                                <tr key={obj.address}>
                                    <td style={{padding: '0 1em 0 1em'}}>
                                        {obj.locator}
                                    </td><td style={{padding: '0 1em 0 1em'}}>
                                        {obj.address}
                                    </td><td style={{padding: '0 1em 0 1em'}}>
                                        {obj.feeCount}
                                    </td><td style={{padding: '0 1em 0 1em'}}>
                                        {obj.feeAvg}&nbsp;{tokenSym}
                                    </td></tr>)
                        }
                    })}
                </tbody></table>

        </div>
    </div>
    )
}

export default AboutRoute
