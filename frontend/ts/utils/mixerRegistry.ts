import {
    getMixerRegistryContract,
    getMixerContract,
} from '../web3/contract'

import {
    getTokenConfig
} from '../utils/configFrontend'

const getTokenList = async (provider) => {
    const mixerRegistryContract = await getMixerRegistryContract(provider)
    const tokenNb = await mixerRegistryContract.tokenArraySize()
    const ret: Array<{address, tokenConfig}> = []
    for (let tokenIdx = 0; tokenIdx < tokenNb; tokenIdx++){
        let obj = {
            address : await mixerRegistryContract.tokenArray(tokenIdx),
            tokenConfig : null,
        }
        if (obj.address){
            obj.tokenConfig = getTokenConfig(obj.address)
        }
        ret.push(obj)
    }
    return ret
}

const getMixerList = async (provider, tokenAddress) => {
    //defaut address for ethers
    if (!tokenAddress)
        tokenAddress = "0x0000000000000000000000000000000000000000"
    const mixerRegistryContract = await getMixerRegistryContract(provider)
    const ret: Array<{mixAmt, address, semaphore}> = []
    for (let mixAmt of await mixerRegistryContract.getTokenMixerList(tokenAddress)){
        let obj = {
            mixAmt : mixAmt,
            address : null,
            semaphore : null,
        }
        if (obj.mixAmt){
            obj.address = await mixerRegistryContract.getTokenMixerAddress(obj.mixAmt, tokenAddress)
            if (obj.address){
                const mixerContract = await getMixerContract(provider, obj.address)
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
