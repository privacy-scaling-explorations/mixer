import { configMixer } from 'mixer-config'
const deployedAddresses = require('../../deployedAddresses.json')

var fs = require('fs');

const writeLine = (fd, indent, text) => {
    for (let i = 0; i < indent; i++){
        fs.writeSync(fd, "    ")
    }
    fs.writeSync(fd, text)
    fs.writeSync(fd, "\n")
}

const writeHead = (fd, indent, text) => {
    writeLine(fd, indent, text + ":")
}

const writeAProperty = (fd, indent, name, value) => {
    if (value){
        if (typeof value === 'string' || value instanceof String){
            writeLine(fd, indent, name + ': "' + value.replace(/\x22/g, '\\\x22') + '"')
        }else{
            writeLine(fd, indent, name + ': ' + value)
        }
    }
}

const writeProperty = (fd, indent, name, config) => {
     writeAProperty(fd, indent, name, config[name])
}

const surrogethInfo = (path) => {
    console.log("write file")
    fs.open(path, 'w', function (err, fd) {
        if (err){
            throw err
        }
        let indent = 0
        writeProperty(fd, indent, "surrogethPort", configMixer)
        writeHead(fd, indent++, "network")
        for (let configNetworkName of Object.keys(configMixer.get('network'))) {

            let configNetwork = configMixer.get('network.' + configNetworkName)

            if (!(configNetwork.has('disable') && configNetwork.disable)){
                console.log("Network:", configNetworkName)
                let deployedAddressesNetwork = deployedAddresses[configNetworkName]
                writeHead(fd, indent++, configNetworkName)
                writeProperty(fd, indent, "url", configNetwork)
                writeProperty(fd, indent, "chainId", configNetwork)
                writeProperty(fd, indent, "privateKeysPath", configNetwork)
                writeHead(fd, indent++, "token")
                for (let configTokenName of Object.keys(configNetwork.get('token'))) {
                    console.log("\tToken:", configTokenName);
                    let deployedAddressesToken = deployedAddressesNetwork.token[configTokenName]
                    let configToken = configNetwork.get('token.' + configTokenName)
                    writeHead(fd, indent++, configTokenName)
                        if (configToken.address){
                            writeProperty(fd, indent, "address", configToken)
                        }else{
                            if (configToken)
                                writeAProperty(fd, indent, "address", deployedAddressesToken.Token)
                        }
                        writeProperty(fd, indent, "decimals", configToken)
                        if (configToken.surrogethFeeAmt){
                            writeAProperty(fd, indent, "feeAmt", configToken.surrogethFeeAmt)
                        }else{
                            writeProperty(fd, indent, "feeAmt", configToken)
                        }

                    indent--
                }

                indent--

                indent--
            }
        }

    })
}

const main = () => {
    surrogethInfo("../surrogeth/surrogethd/config/surrogeth-mixer.yaml")
}

if (require.main === module) {
    try {
        main()
    } catch (err) {
        console.error(err)
    }
}

export {
    surrogethInfo
}
