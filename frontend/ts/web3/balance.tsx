import * as ethers from 'ethers'
import {
    getTokenContract,
} from './mixer'

import{
    isETH,
    chainId,
} from '../utils/configFrontend'
/*
 * Returns the current account balance in wei.
 * @param context The web3-react context
 */
const getBalance = async (context: any) => {
    const connector = context.connector
    if (connector) {
        if (isETH){
            const provider = new ethers.providers.Web3Provider(
                await connector.getProvider(chainId),
            )
            return await provider.getBalance(context.account)
        }else{
            const tokenContract = await getTokenContract(context)
            return await tokenContract.balanceOf(context.account)
        }
    }
    return null
}

const getBalanceETH = async (context: any) => {
    const connector = context.connector
    if (connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(chainId),
        )
        return await provider.getBalance(context.account)
    }
    return null
}

export { getBalance, getBalanceETH }
