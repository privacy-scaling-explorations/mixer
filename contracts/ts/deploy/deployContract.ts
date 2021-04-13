require('module-alias/register')
import * as argparse from 'argparse'
import * as fs from 'fs'
import * as path from 'path'
import { configMixer } from 'mixer-config'
import { genAccounts } from '../accounts'
import { deployAllContracts, getWallet } from './deployAllContract'

const main = async () => {
    const parser = new argparse.ArgumentParser({
        description: 'Deploy all contracts to an Ethereum network of your choice'
    })

    parser.add_argument(
        '-t', '--token',
        {
            help: 'The token to interact with',
            required: false
        }
    )

    parser.add_argument(
        '-n', '--network',
        {
            help: 'The network to deploy the contracts to',
            required: false
        }
    )

    parser.add_argument(
        '-o', '--output',
        {
            help: 'The filepath to save the addresses of the deployed contracts',
            required: true
        }
    )

    const args = parser.parse_args()
    const outputAddressFile = args.output

    let deployedAddresses
    try{
        deployedAddresses = require('../../deployedAddresses')
    }catch(err){
        deployedAddresses = {}
    }

    for (let configNetworkName of Object.keys(configMixer.get('network'))) {
        let configNetwork = configMixer.get('network.' + configNetworkName)
        if (!configNetwork.disable){
            console.log("Network:", configNetworkName);


            console.log('Using network', configNetwork.get('supportedNetworkName'))

            const accounts = genAccounts(configNetwork)
            const admin = accounts[0]
            console.log('Using account', admin.address)

            if (!deployedAddresses[configNetworkName]){
                deployedAddresses[configNetworkName] = { token : {} }
            }

            let deployedAddressesNetwork = deployedAddresses[configNetworkName]

            for (let configTokenName of Object.keys(configNetwork.get('token'))) {
                console.log("Token:", configTokenName);
                let configToken = configNetwork.get('token.' + configTokenName)

                if (configTokenName){
                    configToken = configMixer.get('network.' + configNetworkName + '.token.' + configTokenName)
                }

                if (configToken){
                    console.log('Using token', configToken.get('sym'))
                }

                if (!deployedAddressesNetwork.token[configTokenName]){
                    deployedAddressesNetwork.token[configTokenName] = {}
                }
                let deployedAddressesToken = deployedAddressesNetwork.token[configTokenName]

                const wallet = getWallet(configNetwork.get('url'), admin.privateKey)

                const {
                    forwarderRegistryERC20Contract,
                    mimcContract,
                    tokenContract,
                    mixerRegistryContract,
                    semaphoreLibraryContract,
                } = await deployAllContracts(
                    configNetworkName,
                    wallet,
                    configToken,
                    admin.address,
                    deployedAddressesNetwork,
                    deployedAddressesToken,
                )

                deployedAddressesNetwork.MiMC = mimcContract.address
                if (mixerRegistryContract)
                    deployedAddressesNetwork.MixerRegistry = mixerRegistryContract.address

                if (semaphoreLibraryContract)
                    deployedAddressesNetwork.SemaphoreLibrary = semaphoreLibraryContract.address

                if (forwarderRegistryERC20Contract)
                    deployedAddressesNetwork.ForwarderRegistryERC20 = forwarderRegistryERC20Contract.address


                if (configTokenName){
                    if (tokenContract){
                        deployedAddressesToken.Token = tokenContract.address
                    }
                }
                const addressJsonPath = path.join(__dirname, '../..', outputAddressFile)
                fs.writeFileSync(
                    addressJsonPath,
                    JSON.stringify(deployedAddresses, null, 2),
                )
            }
        }
    }
    console.log(deployedAddresses)
}

if (require.main === module) {
    try {
        main()
    } catch (err) {
        console.error(err)
    }
}
