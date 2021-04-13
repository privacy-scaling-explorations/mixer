import { ethers } from 'ethers'

import { configMixer } from 'mixer-config'

const getNetworkFromSigner = async (signer : ethers.Signer) => {
    const chainId = await signer.getChainId()
    for (let configNetworkName of Object.keys(configMixer.get('network'))) {
        let configNetwork = configMixer.get('network.' + configNetworkName)
        if (configNetwork.chainId == chainId){
            return configNetworkName
        }
    }
    return undefined
}

export {
    getNetworkFromSigner
}
