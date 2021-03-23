
const configMixer =  require('../../exported_config')

const configEnv = configMixer.env
const backendHost = configMixer.backend.host
const backendPort = configMixer.backend.port

const etcdHost = configMixer.backend.etcd.host
const etcdPort = configMixer.backend.etcd.port
const etcdLockTime = configMixer.backend.etcd.lockTime

export {
    backendHost,
    backendPort,
    etcdHost,
    etcdPort,
    etcdLockTime,
    configEnv,
}
