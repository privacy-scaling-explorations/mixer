require('module-alias/register')
import * as ethers from 'ethers'
import * as argparse from 'argparse'
import * as fs from 'fs'
import * as path from 'path'
import * as etherlime from 'etherlime-lib'
import { config } from 'mixer-config'
import { genAccounts } from '../accounts'


const ERC20Mintable = require('@mixer-contracts/compiled/ERC20Mintable.json')

const deploySemaphore = (deployer, Semaphore, libraries) => {

    return deployer.deploy(
        Semaphore,
        libraries,
        20,
        0,
        12312,
        1000,
    )
}

const deployMixer = (
    deployer,
    Mixer,
    semaphoreContractAddress,
    mixAmtToken,
    tokenAddress,
) => {

    return deployer.deploy(Mixer,
        {},
        semaphoreContractAddress,
        mixAmtToken.toString(10),
        tokenAddress,
    )
}

const deployToken = async (
    deployer: any,
) => {
    const tokenContract = await deployer.deploy(
        ERC20Mintable,
        {},
        'Token',
        'TKN',
        18,
    )

    return tokenContract
}

const deployAllContracts = async (
    deployer,
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
                deployer.signer,
            )
    } else {
        console.log('Deploying Relayer Registry')
        relayerRegistryContract = await deployer.deploy(RelayerRegistry, {})
    }

    //mimc contract
    let mimcContract
    if (deployedAddressesNetwork && deployedAddressesNetwork.MiMC){
        console.log('MiMC already deployed')
        mimcContract = new ethers.Contract(
            deployedAddressesNetwork.MiMC,
            MiMC.abi,
            deployer.signer,
        )
    }else{
        console.log('Deploying MiMC')
        mimcContract = await deployer.deploy(MiMC, {})
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
                deployer.signer,
            )
        } else {
            if (deployedAddressesToken && deployedAddressesToken.token){
                console.log('Token already deployed')
                tokenContract = new ethers.Contract(
                    deployedAddressesToken.token.Token,
                    ERC20Mintable.abi,
                    deployer.signer,
                )
            }else{
                console.log('Deploying token')
                tokenContract = await deployToken(deployer)

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

                console.log('Token Semaphore and Mixer already deployed')
                semaphoreContract = new ethers.Contract(
                    deployedAddressesToken.Semaphore,
                    Semaphore.abi,
                    deployer.signer,
                )
                mixerContract = new ethers.Contract(
                    deployedAddressesToken.Mixer,
                    Mixer.abi,
                    deployer.signer,
                )
        } else {
            console.log('Deploying Semaphore for the Token Mixer')
            semaphoreContract = await deploySemaphore(
                deployer,
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
                deployer,
                Mixer,
                (semaphoreContract.contractAddress ? semaphoreContract.contractAddress : semaphoreContract.resolvedAddress),
                mixAmtToken,
                tokenAddress,
            )

            console.log('Transferring ownership of Token Semaphore to the Token Mixer')
            let tx = await semaphoreContract.transferOwnership(mixerContract.contractAddress)
            await tx.wait()

            console.log('Setting the external nullifier of the Token Semaphore contract')
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
            required: true
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

    const configNetwork = config.get('network.' + args.network)
    console.log('Using network', configNetwork.get('supportedNetworkName'))

    const accounts = genAccounts(configNetwork)
    const admin = accounts[0]
    console.log('Using account', admin.address)

    let configToken

    if (args.token){
        configToken = config.get('network.' + args.network + '.token.' + args.token)
    }

    if (configToken){
        console.log('Using token', configToken.get('sym'))
    }

    let deployedAddresses
    try{
        deployedAddresses = require('../../deployedAddresses')
    }catch(err){
        deployedAddresses = {}
    }

    const deployedAddressesNetwork = deployedAddresses[args.network]

    let deployedAddressesToken
    if (deployedAddressesNetwork && deployedAddressesNetwork.token){
        deployedAddressesToken = deployedAddressesNetwork.token[args.token]
    }

    console.log("deployedAddressesToken", deployedAddressesToken)

    const deployer = new etherlime.JSONRPCPrivateKeyDeployer(
        admin.privateKey,
        configNetwork.get('url'),
        {
            chainId: configNetwork.get('chainId'),
        },
    )

    const {
        relayerRegistryContract,
        mimcContract,
        tokenContract,
        semaphoreContract,
        mixerContract,
    } = await deployAllContracts(
        deployer,
        configToken,
        admin.address,
        deployedAddressesNetwork,
        deployedAddressesToken,
    )

    const addresses = deployedAddresses

    addresses[args.network] = {
        MiMC: mimcContract.contractAddress ? mimcContract.contractAddress : mimcContract.address,
        RelayerRegistry: relayerRegistryContract.contractAddress ? relayerRegistryContract.contractAddress : relayerRegistryContract.address,
        token : deployedAddressesNetwork.token ? deployedAddressesNetwork.token : {},
    }

    if (args.token){
        addresses[args.network].token[args.token] = {
            Mixer: mixerContract.contractAddress ? mixerContract.contractAddress : mixerContract.address,
            Semaphore: semaphoreContract.contractAddress ? semaphoreContract.contractAddress : semaphoreContract.address,
        }
        if (tokenContract){
            addresses[args.network].token[args.token].Token = tokenContract.contractAddress ? tokenContract.contractAddress : tokenContract.address
        }

    }

    const addressJsonPath = path.join(__dirname, '../..', outputAddressFile)
    fs.writeFileSync(
        addressJsonPath,
        JSON.stringify(addresses),
    )

    console.log(addresses)
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
