import { configMixer } from './index'

if (require.main === module) {
    let c = JSON.parse(JSON.stringify(configMixer))
    console.log(JSON.stringify(configMixer, null, 2))
}
