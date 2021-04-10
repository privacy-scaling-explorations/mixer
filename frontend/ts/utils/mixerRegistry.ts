import {
    getMixerRegistryContract,
    getMixerContract,
} from '../web3/mixer'

import {
    getTokenConfig
} from '../utils/configFrontend'

const getTokenList = async (wallet) => {
    const mixerRegistryContract = await getMixerRegistryContract(wallet.provider)
    const tokenNb = await mixerRegistryContract.tokenArraySize()
    const ret = []
    for (let tokenIdx = 0; tokenIdx < tokenNb; tokenIdx++){
        let obj = {address:await mixerRegistryContract.tokenArray(tokenIdx)}
        if (obj.address){
            obj.tokenConfig = getTokenConfig(obj.address)
        }
        ret.push(obj)
    }
    return ret
}

const getMixerList = async (wallet, tokenAddress) => {
    //defaut address for ethers
    if (!tokenAddress)
        tokenAddress = "0x0"
    const mixerRegistryContract = await getMixerRegistryContract(wallet.provider)
    const ret = []
    for (let mixAmt of await mixerRegistryContract.getTokenMixerList(tokenAddress)){
        let obj = {mixAmt : mixAmt}
        if (obj.mixAmt){
            obj.address = await mixerRegistryContract.getTokenMixerAddress(obj.mixAmt, tokenAddress)
            if (obj.address){
                const mixerContract = await getMixerContract(wallet.provider, obj.address)
                if (mixerContract){
                    obj.semaphore = await mixerContract.semaphore()
                }
            }
        }
        ret.push(obj)
    }
    return ret
}

export {
    getTokenList,
    getMixerList,
}
