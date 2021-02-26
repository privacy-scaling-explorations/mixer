require('module-alias/register')
import * as ethers from 'ethers'
import * as argparse from 'argparse'
import * as fs from 'fs'
import * as path from 'path'
import { configMixer } from 'mixer-config'
import { genAccounts } from '../accounts'


const ERC20Mintable = require('@mixer-contracts/compiled/ERC20Mintable.json')

function link(bytecode, libName, libAddress) {
  let symbol = "__" + libName + "_".repeat(40 - libName.length - 2);
  return bytecode.split(symbol).join(libAddress.toLowerCase().substr(2))
}

const deploySemaphore = async (wallet, Semaphore, libraries) => {
    //bytecode = link(bytecode, libraries[0].name, libraries[0].address)

    console.log(libraries)

    let factory = new ethers.ContractFactory(
        Semaphore.abi,
        Semaphore.bytecode,
        wallet,
    )
    let contract = await factory.deploy(
        20,
        0,
        12312,
        1000,
    )
    await contract.deployed()
    return contract
}

const deployMixer = async (
    wallet,
    Mixer,
    semaphoreContractAddress,
    mixAmtToken,
    tokenAddress,
) => {
    let factory = new ethers.ContractFactory(
        Mixer.abi,
        Mixer.bytecode,
        wallet,
    )
    let contract = await factory.deploy(
        semaphoreContractAddress,
        mixAmtToken.toString(10),
        tokenAddress,
    )
    await contract.deployed()
    return contract
}

const deployToken = async (
    wallet: any,
) => {
    let factory = new ethers.ContractFactory(
        ERC20Mintable.abi,
        ERC20Mintable.bytecode,
        wallet,
    )
    let contract = await factory.deploy(
        'Token',
        'TKN',
        18,
    )
    await contract.deployed()
    return contract
}

const deployAllContracts = async (
    wallet,
    configToken,
    adminAddress,
    deployedAddressesNetwork,
    deployedAddressesToken,
) => {

    let semaphoreContract
    let mixerContract

    const MiMC = require('@mixer-contracts/compiled/MiMC.json')
    const Semaphore = require('@mixer-contracts/compiled/Semaphore.json')
    const Mixer = require('@mixer-contracts/compiled/Mixer.json')
    const RelayerRegistry = require('@mixer-contracts/compiled/RelayerRegistry.json')

    //relay registry contract
    let relayerRegistryContract
    if (deployedAddressesNetwork && deployedAddressesNetwork.hasOwnProperty('RelayerRegistry')){
        console.log('Relayer Registry already deployed')
        relayerRegistryContract = new ethers.Contract(
                deployedAddressesNetwork.RelayerRegistry,
                RelayerRegistry.abi,
                wallet,
            )
    } else {
        console.log('Deploying Relayer Registry')
        relayerRegistryContract = await wallet.deploy(RelayerRegistry)
    }

    //mimc contract
    let mimcContract
    if (deployedAddressesNetwork && deployedAddressesNetwork.MiMC){
        console.log('MiMC already deployed')
        mimcContract = new ethers.Contract(
            deployedAddressesNetwork.MiMC,
            MiMC.abi,
            wallet,
        )
    }else{
        console.log('Deploying MiMC')
        mimcContract = await wallet.deploy(MiMC)
    }

    //libraries for semaphore
    const libraries = {
        MiMC: mimcContract.contractAddress ? mimcContract.contractAddress : mimcContract.address,
    }

    //token contract
    let tokenContract
    if (configToken  && configToken.hasOwnProperty('decimals')){
        if (configToken.has('deployedAddresse')){
            console.log('Using existing token contract')
            tokenContract = new ethers.Contract(
                configToken.deployedAddresse,
                ERC20Mintable.abi,
                wallet,
            )
        } else {
            if (deployedAddressesToken && deployedAddressesToken.token){
                console.log('Token already deployed')
                tokenContract = new ethers.Contract(
                    deployedAddressesToken.token.Token,
                    ERC20Mintable.abi,
                    wallet,
                )
            }else{
                console.log('Deploying token')
                tokenContract = await deployToken(wallet)

                console.log('Minting tokens')
                await tokenContract.mint(adminAddress, '100000000000000000000')
            }
        }
    }

    //mixer && semaphore contract
    if (configToken){

        if (deployedAddressesToken &&
            deployedAddressesToken.hasOwnProperty('Semaphore') &&
            deployedAddressesToken.hasOwnProperty('Mixer')){

                console.log('Semaphore and Mixer already deployed')
                semaphoreContract = new ethers.Contract(
                    deployedAddressesToken.Semaphore,
                    Semaphore.abi,
                    wallet,
                )
                mixerContract = new ethers.Contract(
                    deployedAddressesToken.Mixer,
                    Mixer.abi,
                    wallet,
                )
        } else {
            console.log('Deploying Semaphore for the Mixer')
            semaphoreContract = await deploySemaphore(
                wallet,
                Semaphore,
                libraries,
            )

            const mixAmt = configToken.get('mixAmt')

            let mixAmtToken
            let tokenAddress
            //For token
            if (configToken.has('decimals')){
                let decimals = configToken.get('decimals')
                mixAmtToken = mixAmt * (10 ** decimals)
                tokenAddress = tokenContract.contractAddress ? tokenContract.contractAddress : tokenContract.address
            //For ETH
            } else {
                mixAmtToken = mixAmt * (10 ** 18)
                //Token address 0x for ETH
                tokenAddress = '0x0000000000000000000000000000000000000000'
            }

            console.log('Deploying the Token Mixer')
            mixerContract = await deployMixer(
                wallet,
                Mixer,
                (semaphoreContract.contractAddress ? semaphoreContract.contractAddress : semaphoreContract.resolvedAddress),
                mixAmtToken,
                tokenAddress,
            )

            console.log('Transferring ownership of Semaphore to the Mixer')
            let tx = await semaphoreContract.transferOwnership(mixerContract.contractAddress)
            await tx.wait()

            console.log('Setting the external nullifier of the Semaphore contract')
            tx = await mixerContract.setSemaphoreExternalNulllifier({ gasLimit: 100000 })
            await tx.wait()
        }
    }

    return {
        relayerRegistryContract,
        mimcContract,
        tokenContract,
        semaphoreContract,
        mixerContract,
    }
}

const main = async () => {
    const parser = new argparse.ArgumentParser({
        description: 'Deploy all contracts to an Ethereum network of your choice'
    })

    parser.addArgument(
        ['-t', '--token'],
        {
            help: 'The token to interact with',
            required: false
        }
    )

    parser.addArgument(
        ['-n', '--network'],
        {
            help: 'The network to deploy the contracts to',
            required: false
        }
    )

    parser.addArgument(
        ['-o', '--output'],
        {
            help: 'The filepath to save the addresses of the deployed contracts',
            required: true
        }
    )

    const args = parser.parseArgs()
    const outputAddressFile = args.output

    let deployedAddresses
    try{
        deployedAddresses = require('../../deployedAddresses')
    }catch(err){
        deployedAddresses = {}
    }

    for (let configNetworkName of Object.keys(configMixer.get('network'))) {
        let configNetwork = configMixer.get('network.' + configNetworkName)
        if (!(configNetwork.has('disable'))){
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

                const provider = new ethers.providers.JsonRpcProvider(configNetwork.get('url'))
                const wallet = new ethers.Wallet ( admin.privateKey , provider )
                wallet["deploy"] = async (contractSource) => {

                    let factory = new ethers.ContractFactory(
                        contractSource.abi,
                        contractSource.bytecode,
                        this,
                    )
                    let contract = await factory.deploy()
                    await contract.deployed()
                    return contract
                }

                const {
                    relayerRegistryContract,
                    mimcContract,
                    tokenContract,
                    semaphoreContract,
                    mixerContract,
                } = await deployAllContracts(
                    wallet,
                    configToken,
                    admin.address,
                    deployedAddressesNetwork,
                    deployedAddressesToken,
                )

                deployedAddressesNetwork.MiMC =
                  mimcContract.contractAddress ?
                  mimcContract.contractAddress :
                  mimcContract.address
                deployedAddressesNetwork.RelayerRegistry =
                  relayerRegistryContract.contractAddress ?
                  relayerRegistryContract.contractAddress :
                  relayerRegistryContract.address

                if (configTokenName){
                    deployedAddressesToken.Semaphore =
                      semaphoreContract.contractAddress ?
                      semaphoreContract.contractAddress :
                      semaphoreContract.address
                    deployedAddressesToken.Mixer =
                      mixerContract.contractAddress ?
                      mixerContract.contractAddress :
                      mixerContract.address

                    if (tokenContract){
                        deployedAddressesToken.Token =
                          tokenContract.contractAddress ?
                          tokenContract.contractAddress :
                          tokenContract.address
                    }
                }
            }
        }
    }
    const addressJsonPath = path.join(__dirname, '../..', outputAddressFile)
    fs.writeFileSync(
        addressJsonPath,
        JSON.stringify(deployedAddresses),
    )

    console.log(deployedAddresses)
}


if (require.main === module) {
    try {
        main()
    } catch (err) {
        console.error(err)
    }
}

export {
    deployToken,
    deployAllContracts,
}
