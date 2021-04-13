import * as ethers from 'ethers'
import {
    deployContract,
    getWallet,
} from '../deploy/deployAllContract'

import {
    checkErrorReason,
    addressInfo,
} from './utils'

import {
    getNetworkFromSigner
} from '../utils/configUtils'

import { genAccounts } from '../accounts'
const Mixer = require('@mixer-contracts/compiled/Mixer.json')

import { testToken } from './testToken'

const testNetwork = (configNetworkName, configNetwork, deployedAddresses) => {
    console.log("Test network:", configNetworkName);

    if (!deployedAddresses[configNetworkName]){
        deployedAddresses[configNetworkName] = { token : {} }
    }

    let deployedAddressesNetwork = deployedAddresses[configNetworkName]

    const accounts = genAccounts(configNetwork)

    expect(accounts[0]).toBeTruthy();
    const depositorAddress = accounts[0].address


    expect(accounts[1]).toBeTruthy();
    const recipientAddress = accounts[1].address


    expect(accounts[2]).toBeTruthy();
    let relayerAddress = accounts[2].address

    let wallet

    wallet = getWallet(configNetwork.get('url'), accounts[0].privateKey)
    expect(wallet).toBeTruthy()

    describe(configNetworkName + ' Network test', () => {
        it('should not deploy Mixer if the Semaphore contract address is invalid', async () => {
            const mixAmtToken = ethers.BigNumber.from((1 * (10 ** 18)).toString())
            try{
                const tx = await deployContract(wallet,
                    Mixer,
                    '0x0000000000000000000000000000000000000000',
                    mixAmtToken,
                    '0x0000000000000000000000000000000000000000',
                    //{ gasLimit: 500000 }
                )
                expect(true).toBeFalsy()
            }catch (error){
                checkErrorReason(error, 'Mixer: invalid Semaphore address')
            }
        })
        it('Network address balance', async () => {
            await addressInfo("depositorAddress", depositorAddress, true, wallet, 18, null)
            await addressInfo("recipientAddress", recipientAddress, true, wallet, 18, null)
            await addressInfo("relayerAddress", relayerAddress, true, wallet, 18, null)
        })
        it('Network ChainId check', async() => {
            expect(await getNetworkFromSigner(wallet)).toMatch(configNetworkName)

        })
    })

    for (let configTokenName of Object.keys(configNetwork.get('token'))) {
        testToken(
            configNetwork,
            configNetworkName,
            configTokenName,
            deployedAddressesNetwork,
            wallet,
            depositorAddress,
            recipientAddress,
            relayerAddress,
            accounts,
        )
    }
}

export {testNetwork}
