import React from 'react'
import { ethers } from 'ethers'

import {
    chainId,
    supportedNetworkName,
} from '../utils/configFrontend'

declare global {
    interface Window { ethereum: any; }
}

const provider = null

const context = {
    provider : provider,
    signer : null,
    address : null,
    networkChainId : null,
}

const ConnectionContext = React.createContext(context)

const connectionConnect = (context) => {
    try {
        if (!context.provider){
            context.provider = new ethers.providers.Web3Provider(window.ethereum, {name : supportedNetworkName, chainId : chainId})
            context.signer = context.provider.getSigner()
        }
        context.signer.getAddress().then((address) => {context.address = address})
        context.provider.getNetwork().then((network) => {context.networkChainId = network.chainId})
        //context.provider = new ethers.providers.Web3Provider(window.ethereum, "any")
    }catch(err){
        console.log(err)
    }
}

export { ConnectionContext, connectionConnect }
