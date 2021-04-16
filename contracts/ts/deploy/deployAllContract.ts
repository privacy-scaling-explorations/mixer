require('module-alias/register')
import * as ethers from 'ethers'
import {
    deployMixer,
} from "../contract/mixerRegistry"

const ERC20Mintable = require('@mixer-contracts/compiled/ERC20Mintable.json')
const MiMC = require('@mixer-contracts/compiled/MiMC.json')
const Semaphore = require('@mixer-contracts/compiled/Semaphore.json')
const Mixer = require('@mixer-contracts/compiled/Mixer.json')
const MixerRegistry = require('@mixer-contracts/compiled/MixerRegistry.json')
const SemaphoreLibrary = require('@mixer-contracts/compiled/SemaphoreLibrary.json')
const ForwarderRegistryERC20 = require('@mixer-contracts/compiled/ForwarderRegistryERC20.json')

const deployContract = async (wallet, contract, ...args: any[]) => {
    let factory = new ethers.ContractFactory(
        contract.abi,
        contract.bytecode,
        wallet,
    )
    console.log("Deploy contract size ", (contract.bytecode.length / 2) - 1, "< max ethereum size", 24576);
    console.time("Deploy contract");
    //calculate the estimate gas (not eeded, to check for error)
    let tx = factory.getDeployTransaction(...args)
    console.log("Deploy contract --> estimate gas : " , (await wallet.estimateGas(tx)).toString())
    //console.timeLog("Deploy contract");

    let contractToDeploy = await factory.deploy(...args)
    //console.timeLog("Deploy contract");
    await contractToDeploy.deployed()
    console.timeEnd("Deploy contract");
    console.log("contract deployed ", contractToDeploy.address)
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
        if(libraries[library]){
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
    }
    return bytecode
}

const deployMixerRegistry = async (wallet, MixerRegistry, libraries) => {

    const MixerRegistryWithLib = {
        abi : MixerRegistry.abi,
        bytecode : linkLibrary(MixerRegistry.bytecode, MixerRegistry.linkReferences, libraries),
    }

    return deployContractTryCatch(
        wallet,
        MixerRegistryWithLib,
        20,
        0,
        12312,
    )
}

const deploySemaphoreLibrary = async (wallet, SemaphoreLibrary, libraries) => {

    const SemaphoreLibraryWithLib = {
        abi : SemaphoreLibrary.abi,
        bytecode : linkLibrary(SemaphoreLibrary.bytecode, SemaphoreLibrary.linkReferences, libraries),
    }

    return deployContractTryCatch(
        wallet,
        SemaphoreLibraryWithLib,
    )
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
    network,
    wallet,
    configToken,
    adminAddress,
    deployedAddressesNetwork,
    deployedAddressesToken,
) => {

    //ForwarderRegistryERC20 contract
    let forwarderRegistryERC20Contract
    if (deployedAddressesNetwork && deployedAddressesNetwork.hasOwnProperty('ForwarderRegistryERC20')){
        console.log('ForwarderRegistryERC20 already deployed')
        forwarderRegistryERC20Contract = new ethers.Contract(
                deployedAddressesNetwork.ForwarderRegistryERC20,
                ForwarderRegistryERC20.abi,
                wallet,
            )
    } else {
        console.log('Deploying ForwarderRegistryERC20')
        forwarderRegistryERC20Contract = await deployContractTryCatch(wallet, ForwarderRegistryERC20)
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

    let libraries = {
        MiMC: mimcContract.address,
        SemaphoreLibrary: null,
    }

    //token contract for test
    let tokenContract
    if (configToken  && configToken.hasOwnProperty('decimals')){
        if (configToken.has('address')){
            console.log('Using existing token contract')
            tokenContract = new ethers.Contract(
                configToken.address,
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

    //SemaphoreLibrary contract
    let semaphoreLibraryContract
    if (deployedAddressesNetwork &&
        deployedAddressesNetwork.hasOwnProperty('SemaphoreLibrary')){
        console.log('SemaphoreLibrary already deployed')
        semaphoreLibraryContract = new ethers.Contract(
            deployedAddressesNetwork.SemaphoreLibrary,
            SemaphoreLibrary.abi,
            wallet,
        )
    } else {
        console.log('Deploying SemaphoreLibrary')
        semaphoreLibraryContract = await deploySemaphoreLibrary(
            wallet,
            SemaphoreLibrary,
            libraries,
        )
    }
    libraries = {
        MiMC: mimcContract.address,
        SemaphoreLibrary: semaphoreLibraryContract.address,
    }

    //MixerRegistry contract
    let mixerRegistryContract
    if (deployedAddressesNetwork &&
        deployedAddressesNetwork.hasOwnProperty('MixerRegistry')){
        console.log('MixerRegistry already deployed')
        mixerRegistryContract = new ethers.Contract(
            deployedAddressesNetwork.MixerRegistry,
            MixerRegistry.abi,
            wallet,
        )
    } else {
        console.log('Deploying MixerRegistry')
        mixerRegistryContract = await deployMixerRegistry(
            wallet,
            MixerRegistry,
            libraries,
        )
    }

    //mixer
    if (configToken){
        let mixerAddress
        if (deployedAddressesToken &&
            deployedAddressesToken.hasOwnProperty('Mixer')){
                console.log('Mixer already deployed')
            mixerAddress = deployedAddressesToken.Mixer
        } else {
            const mixAmt = configToken.get('mixAmt')

            if (Array.isArray(mixAmt)){
                for (let i = 0; i < mixAmt.length; i++){
                    let mixAmtWei
                    let tokenAddress
                    //For token
                    if (configToken.has('decimals')){
                        let decimals = configToken.get('decimals')
                        mixAmtWei = ethers.utils.parseUnits(mixAmt[i].toString(), decimals)
                        tokenAddress = tokenContract.address
                    //For ETH
                    } else {
                        mixAmtWei = ethers.utils.parseEther(mixAmt[i].toString())
                        //Token address 0x for ETH
                    }
                    mixerAddress = await deployMixer(network, wallet, mixAmtWei, tokenAddress, mixerRegistryContract)
                }
            } else {
                let mixAmtWei
                let tokenAddress
                //For token
                if (configToken.has('decimals')){
                    let decimals = configToken.get('decimals')
                    mixAmtWei = ethers.utils.parseUnits(mixAmt.toString(), decimals)
                    tokenAddress = tokenContract.address
                //For ETH
                } else {
                    mixAmtWei = ethers.utils.parseEther(mixAmt.toString())
                    //Token address 0x for ETH
                }
                mixerAddress = await deployMixer(network, wallet, mixAmtWei, tokenAddress, mixerRegistryContract)
            }
        }
    }

    return {
        forwarderRegistryERC20Contract,
        mimcContract,
        tokenContract,
        mixerRegistryContract,
        semaphoreLibraryContract,
    }
}

export {
    deployContract,
    getWallet,
    deployAllContracts,
}
