import * as ethers from 'ethers'
import configMixer from 'mixer-config'

const genAccounts = (_configNetwork: configMixer) => {
    let privateKeys = require("../../" + _configNetwork.get('privateKeysPath'))
    return privateKeys.map((pk: string) => {
        return new ethers.Wallet(pk)
    })
}

const genTestAccounts = (num: number, mnemonic: string) => {
    let accounts: ethers.Wallet[] = []

    for (let i=0; i<num; i++) {
        const path = `m/44'/60'/${i}'/0/0`
        const wallet = ethers.Wallet.fromMnemonic(mnemonic, path)
        accounts.push(wallet)
    }

    return accounts
}

export { genAccounts, genTestAccounts }
