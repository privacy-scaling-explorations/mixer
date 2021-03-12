import { configMixer } from './index'

if (require.main === module) {
    let c = JSON.parse(JSON.stringify(configMixer))
    if (c.chain.privateKeys) {
        delete c.chain.privateKeys
    }
    if (c.backend.hotWalletPrivKey) {
        delete c.backend.hotWalletPrivKey
    }
    console.log(JSON.stringify(configMixer, null, 2))
}
