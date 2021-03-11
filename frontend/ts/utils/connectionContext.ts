import React from 'react'
import { ethers } from 'ethers'

import {
    chainId,
    supportedNetworkName,
} from '../utils/configFrontend'

declare global {
    interface Window { ethereum: any; }
}

import {
    getTokenContract,
} from '../web3/mixer'

import{
    isETH,
    tokenDecimals,
    mixerAddress,
} from '../utils/configFrontend'

//reload page when metamask chain change
window.ethereum.on('chainChanged', (_chainId) => window.location.reload());
window.ethereum.on('accountsChanged', (accounts: Array<string>) => {console.log(accounts);window.location.reload()});


const context = {
    provider : null,
    signer : null,
    address : null,
    networkChainId : null,
    balance : 0,
    tokenBalance : 0,
    allowance : 0,
}

const ConnectionContext = React.createContext(context)

const connectionConnect = (context) => {
    try {
        if (!context.provider){
            context.provider = new ethers.providers.Web3Provider(window.ethereum, {name : supportedNetworkName, chainId : chainId})
            context.signer = context.provider.getSigner()
        }

        context.signer.getAddress().then((address) => {context.address = address}).catch(err => console.log("error in get address ", err))

        context.provider.getNetwork().then((network) => {context.networkChainId = network.chainId}).catch(err => console.log("error in get network ", err))

        if (context.address){
            context.provider.getBalance(context.address).then((balance) => {
                //console.log("balance", balance)
                context.balance = parseFloat(ethers.utils.formatUnits(balance, 18))
            }).catch(err => console.log("error in get balance ", err))
            if (!isETH){
                getTokenContract(context.provider).then((tokenContract) => {
                    tokenContract.balanceOf(context.address).then((balance) => {
                        context.tokenBalance = parseFloat(ethers.utils.formatUnits(balance, tokenDecimals))
                    }).catch(err => console.log("error in get token balance ", err))
                    tokenContract.allowance(context.address, mixerAddress).then((allowance) => {
                        context.allowance = parseFloat(ethers.utils.formatUnits(allowance, tokenDecimals))
                    }).catch(err => console.log("error in get token allowance ", err))
                }).catch(err => console.log("error in get token contract ", err))

            }
        }



    }catch(err){
        console.log(err)
        throw err
    }
}

export { ConnectionContext, connectionConnect }
