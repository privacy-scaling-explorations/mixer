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

const context = {provider : provider}

const ConnectionContext = React.createContext(context)

const connectionConnect = (context) => {
    if (!context.provider){
        try {
            
            context.provider = new ethers.providers.Web3Provider(window.ethereum, {name : supportedNetworkName, chainId : chainId})
            //context.provider = new ethers.providers.Web3Provider(window.ethereum, "any")
        }catch(err){
            console.log(err)
        }
    }
}

export { ConnectionContext, connectionConnect }
