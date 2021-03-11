import * as ethers from 'ethers'
import {
    getTokenContract,
} from './mixer'

import{
    isETH,
} from '../utils/configFrontend'
/*
 * Returns the current account balance in wei.
 * @param context The web3-react context
 */
const getBalance = async (provider: any, address) => {
    if (isETH){
        return await provider.getBalance(address)
    }else{
        const tokenContract = await getTokenContract(provider)
        return await tokenContract.balanceOf(address)
    }
}

export { getBalance }
