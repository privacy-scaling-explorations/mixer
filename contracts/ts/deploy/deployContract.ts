require('module-alias/register')
import * as ethers from 'ethers'
import * as argparse from 'argparse'
import * as fs from 'fs'
import * as path from 'path'
import { configMixer } from 'mixer-config'
import { genAccounts } from '../accounts'


const ERC20Mintable = require('@mixer-contracts/compiled/ERC20Mintable.json')
const MiMC = require('@mixer-contracts/compiled/MiMC.json')
const Semaphore = require('@mixer-contracts/compiled/Semaphore.json')
const Mixer = require('@mixer-contracts/compiled/Mixer.json')
const RelayerRegistry = require('@mixer-contracts/compiled/RelayerRegistry.json')

const deployContract = async (wallet, contract, ...args: any[]) => {
    let factory = new ethers.ContractFactory(
        contract.abi,
        contract.bytecode,
        wallet,
    )
    //calculate the estimate gas (not eeded, to check for error)
    //let tx = factory.getDeployTransaction(...args)
    //console.log("Deploy contract --> estimate gas : " , (await wallet.estimateGas(tx)).toString())

    console.time("Deploy contract");
    let contractToDeploy = await factory.deploy(...args)
    console.timeLog("Deploy contract");
    await contractToDeploy.deployed()
    console.timeEnd("Deploy contract");
    return contractToDeploy
}

const deployContractTryCatch = async (wallet, contract, ...args: any[]) => {
    try{
        return deployContract(wallet, contract, ...args)
    }catch (err){
        console.log(err.toString())
    }
    return null
}

const getWallet = (url, privateKey) => {
    const provider = new ethers.providers.JsonRpcProvider(url)
    const wallet = new ethers.Wallet ( privateKey , provider )
    return wallet
}

//Replace link patern in semaphore of 20 bytes to the linked library address of 20 bytes
function linkLibrary(bytecode, linkReferences, libraries) {
    for (var library in libraries) {
        let libraryAddress = libraries[library].toLowerCase().substr(2)
        for (var linkFile in linkReferences) {
            for (var linkRef in linkReferences[linkFile]) {
                if (library == linkRef){
                    linkReferences[linkFile][linkRef].forEach(ref => {
                        bytecode = bytecode.substring(0, ref.start * 2) +
                            libraryAddress +
                            bytecode.substring(ref.start * 2 + ref.length * 2)
                    })
                }
            }
        }
    }
    return bytecode
}

const deploySemaphore = async (wallet, Semaphore, libraries) => {

    const SemaphoreWithLib = {
        abi : Semaphore.abi,
        bytecode : linkLibrary(Semaphore.bytecode, Semaphore.linkReferences, libraries),
    }

    return deployContractTryCatch(
        wallet,
        SemaphoreWithLib,
        20,
        0,
        12312,
    )
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
        relayerRegistryContract = await deployContractTryCatch(wallet, RelayerRegistry)
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
        mimcContract = await deployContractTryCatch(wallet, MiMC)
    }

    //libraries for semaphore

    const libraries = {
        MiMC: mimcContract.address,
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
            if (deployedAddressesToken && deployedAddressesToken.Token){
                console.log('Token already deployed')
                tokenContract = new ethers.Contract(
                    deployedAddressesToken.Token,
                    ERC20Mintable.abi,
                    wallet,
                )
            }else{
                console.log('Deploying token')
                tokenContract = await deployContractTryCatch(
                    wallet,
                    ERC20Mintable,
                    configToken.name,
                    configToken.sym,
                    configToken.decimals,
                )

                console.log('Minting tokens')
                let tx = await tokenContract.mint(adminAddress, '10000000000000000000000')
                await tx.wait()
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
                tokenAddress = tokenContract.address
            //For ETH
            } else {
                mixAmtToken = mixAmt * (10 ** 18)
                //Token address 0x for ETH
                tokenAddress = '0x0000000000000000000000000000000000000000'
            }

            console.log('Deploying the Token Mixer')
            mixerContract = await deployContractTryCatch(
                wallet,
                Mixer,
                semaphoreContract.address,
                mixAmtToken.toString(),
                tokenAddress,
            )

            console.log('Transferring ownership of Semaphore to the Mixer')
            let tx = await semaphoreContract.transferOwnership(mixerContract.address)
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

                const wallet = getWallet(configNetwork.get('url'), admin.privateKey)

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

                deployedAddressesNetwork.MiMC = mimcContract.address
                deployedAddressesNetwork.RelayerRegistry = relayerRegistryContract.address

                if (configTokenName){
                    deployedAddressesToken.Semaphore = semaphoreContract.address
                    deployedAddressesToken.Mixer = mixerContract.address

                    if (tokenContract){
                        deployedAddressesToken.Token = tokenContract.address
                    }
                }
            }
        }
    }
    const addressJsonPath = path.join(__dirname, '../..', outputAddressFile)
    fs.writeFileSync(
        addressJsonPath,
        JSON.stringify(deployedAddresses, null, 2),
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
    deployContract,
    getWallet,
    deployAllContracts,
}
