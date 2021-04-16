import {ethers} from 'ethers'

import {
    getMixerRegistryContract,
    getMixerContract,
} from '../utils/contractUtils'

const getMixerList = async (
    provider,
    tokenAddress : string,
    network : string,
    mixerRegistryAddress?: string
) => {
    //defaut address for ethers
    if (!tokenAddress)
        tokenAddress = "0x0000000000000000000000000000000000000000"
    const mixerRegistryContract = await getMixerRegistryContract(provider, network, mixerRegistryAddress)
    const ret: Array<{mixAmt, address, semaphore}> = []
    console.log("getTokenMixerList")
    for (let mixAmt of await mixerRegistryContract.getTokenMixerList(tokenAddress)){
        console.log("getTokenMixerList loop")
        let obj : {
            mixAmt : ethers.BigNumber,
            address : string | undefined,
            semaphore : string | undefined,
        } = {
            mixAmt : mixAmt,
            address : undefined,
            semaphore : undefined,
        }
        if (obj.mixAmt){
            obj.address = await mixerRegistryContract.getTokenMixerAddress(obj.mixAmt, tokenAddress)
            if (obj.address){
                const mixerContract = await getMixerContract(provider, obj.address, network)
                if (mixerContract){
                    obj.semaphore = await mixerContract.semaphore()
                }
            }
        }
        ret.push(obj)
    }
    return ret
}

const deployMixer = async (
    network,
    signer,
    mixAmtWei,
    tokenAddress,
    mixerRegistryContract?:ethers.Contract
) => {
    if (!mixerRegistryContract){
        mixerRegistryContract = await getMixerRegistryContract(signer, network)
    }


    //for ETH
    if (!tokenAddress){
        tokenAddress = '0x0000000000000000000000000000000000000000'
    }

    let mixerAddress = await mixerRegistryContract.getTokenMixerAddress(
        mixAmtWei.toString(),
        tokenAddress)

    if (mixerAddress == '0x0000000000000000000000000000000000000000'){
        console.log('Deploy mixer')
        const tx = await mixerRegistryContract.newMixer(
            mixAmtWei.toString(),
            tokenAddress)
        await tx.wait()
        mixerAddress = await mixerRegistryContract.getTokenMixerAddress(
            mixAmtWei.toString(),
            tokenAddress)
    }else{
        console.log('Mixer was already deployed : ' + mixerAddress)
    }

    return mixerAddress
}

export {
    getMixerList,
    deployMixer,
}
