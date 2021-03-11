require('module-alias/register')
require('events').EventEmitter.defaultMaxListeners = 0

const path = require('path');
import * as ethers from 'ethers'

import { configMixer } from 'mixer-config'
import {
    performeDeposit,
    checkErrorReason,
    mix,
    mixERC20,
    genDepositProof,
    areEqualAddresses,
    getSnarks,
    addressInfo,
} from './utils'

import { sleep } from 'mixer-utils'
import {
    genIdentity,
    genIdentityCommitment,
    genMixerWitness,
    genProof,
    verifyProof,
    verifySignature,
    genPublicSignals,
} from 'libsemaphore'

import { genAccounts } from '../accounts'
const Mixer = require('@mixer-contracts/compiled/Mixer.json')
const ERC20Mintable = require('@mixer-contracts/compiled/ERC20Mintable.json')

import {
    deployContract,
    getWallet,
    deployAllContracts,
} from '../deploy/deployContract'

let deployedAddresses
try{
    deployedAddresses = require('../../deployedAddresses')
}catch(err){
    deployedAddresses = {}
}

for (let configNetworkName of Object.keys(configMixer.get('network'))) {

  let configNetwork = configMixer.get('network.' + configNetworkName)

  if (!(configNetwork.has('disable') && configNetwork.disable)){

      console.log("Test network:", configNetworkName, configNetwork);

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

      let isETH = 1
      let wallet = getWallet(configNetwork.get('url'), accounts[0].privateKey)
      expect(wallet).toBeTruthy()


      it('address balance', async () => {
          await addressInfo(configNetworkName + " depositorAddress", depositorAddress, isETH, wallet, 18, null)
          await addressInfo(configNetworkName + " recipientAddress", recipientAddress, isETH, wallet, 18, null)
          await addressInfo(configNetworkName + " relayerAddress", relayerAddress, isETH, wallet, 18, null)
      })


      for (let configTokenName of Object.keys(configNetwork.get('token'))) {
          console.log("Test token:", configTokenName);
          let configToken = configNetwork.get('token.' + configTokenName)


          describe(configNetworkName + '.' + configTokenName + ' Mixer', () => {

              if (!deployedAddressesNetwork.token[configTokenName]){
                  deployedAddressesNetwork.token[configTokenName] = {}
              }
              let deployedAddressesToken = deployedAddressesNetwork.token[configTokenName]


              let isETH = 0
              if (!configToken.has('decimals')){
                  isETH = 1
              }

              let decimals
              let mixAmtToken
              let feeAmt
              if (isETH){
                  decimals = 18
              }else{
                  decimals = configToken.get('decimals')
              }

              mixAmtToken = ethers.BigNumber.from((configToken.get('mixAmt') * (10 ** decimals)).toString())
              feeAmt = ethers.BigNumber.from((configToken.get('feeAmt') * (10 ** decimals)).toString())

              const users = accounts.slice(1, 6).map((user) => user.address)
              const identities = {}

              const contractsPath = path.join(
                  __dirname,
                  '../..',
                  'compiled',
              )

              for (let i=0; i < users.length; i++) {
                  const user = users[i]

                  const identity = genIdentity()
                  identities[user] = identity
              }

              let mimcContract
              let mixerContract
              let semaphoreContract
              let relayerRegistryContract
              let tokenContract
              let externalNullifier : string




              beforeAll( done =>  {



                  const func_async = (async () => {

                      const contracts = await deployAllContracts(
                          wallet,
                          configToken,
                          depositorAddress,
                          deployedAddressesNetwork,
                          deployedAddressesToken,
                      )

                      expect(contracts).toBeTruthy()
                      relayerRegistryContract = contracts.relayerRegistryContract
                      mimcContract = contracts.mimcContract
                      tokenContract = contracts.tokenContract
                      semaphoreContract = contracts.semaphoreContract
                      mixerContract = contracts.mixerContract
                      expect(mimcContract).toBeTruthy()
                      expect(semaphoreContract).toBeTruthy()
                      expect(mixerContract).toBeTruthy()
                      expect(relayerRegistryContract).toBeTruthy()
                      if (isETH){
                          expect(tokenContract).not.toBeTruthy()
                      }else{
                          expect(tokenContract).toBeTruthy()
                      }
                      externalNullifier = mixerContract.address
                      done()
                  })

                  func_async()
                  //expect(semaphoreContract).toBeTruthy()
              })



              describe('Contract deployments', () => {
                  it('should not deploy Mixer if the Semaphore contract address is invalid', async () => {
                      try{
                          const tx = await deployContract(wallet,
                              Mixer,
                              '0x0000000000000000000000000000000000000000',
                              mixAmtToken,
                              '0x0000000000000000000000000000000000000000',
                              { gasLimit: 500000 }
                          )
                          expect(true).toBeFalsy()
                      }catch (error){
                          checkErrorReason(error, 'Mixer: invalid Semaphore address')
                      }

                  })

                  it('should not deploy mixer if the mixAmt is invalid', async () => {
                      try{
                          const tx = await deployContract(wallet,
                              Mixer,
                              semaphoreContract.address,
                              ethers.utils.parseEther('0'),
                              '0x0000000000000000000000000000000000000000',
                              { gasLimit: 500000 }
                          )
                          expect(true).toBeFalsy()
                      }catch (error){
                          checkErrorReason(error, 'Mixer: invalid mixAmt')
                      }
                  })

                  it('should deploy contracts', () => {
                      expect(ethers.utils.isAddress(mimcContract.address)).toBeTruthy()
                      expect(ethers.utils.isAddress(semaphoreContract.address)).toBeTruthy()
                      expect(ethers.utils.isAddress(mixerContract.address)).toBeTruthy()
                      expect(ethers.utils.isAddress(relayerRegistryContract.address)).toBeTruthy()

                  })

                  it('the Mixer contract should be the owner of the Semaphore contract', async () => {
                      expect(await semaphoreContract.owner()).toBe(mixerContract.address)
                  })

                  it('the Semaphore contract\'s external nullifier should be the mixer contract address', async () => {
                      const semaphoreExtNullifier = await semaphoreContract.getExternalNullifierByIndex(1)
                      const mixerAddress = mixerContract.address
                      expect(areEqualAddresses(semaphoreExtNullifier, mixerAddress)).toBeTruthy()
                  })
              })



              describe('Deposits and withdrawals', () => {

                  if (isETH){
                      /*
                      it('should not add the identity commitment to the contract if the amount is incorrect', async () => {
                          await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: 0 }))

                          const invalidValue = (BigInt(mixAmtToken) + BigInt(1)).toString()
                          await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: invalidValue }))
                      })
                      */

                      it('should fail to call depositERC20() (which is not ETH)', async () => {

                          const identity = identities[users[0]]
                          const identityCommitment = genIdentityCommitment(identity)

                          try {
                              const tx = await mixerContract.depositERC20('0x' + identityCommitment.toString(16), { gasLimit: 1500000 })
                              const receipt = await tx.wait()
                              expect(true).toBeFalsy()
                          } catch (error) {
                              checkErrorReason(error, 'Mixer: only supports tokens')
                          }
                      })
                  } else {
                      it('should fail to call deposit() (which is for ETH only)', async () => {
                          const identity = identities[users[0]]
                          const identityCommitment = genIdentityCommitment(identity)
                          try {
                              const tx = await mixerContract.deposit('0x' + identityCommitment.toString(16), { gasLimit: 1500000 })
                              const receipt = await tx.wait()
                              expect(true).toBeFalsy()
                          } catch (error) {
                              checkErrorReason(error, 'Mixer: only supports ETH')
                          }
                      })
                  }

                  it('should have setup semaphore', async () => {
                      const semaphoreBefore = await mixerContract.semaphore()
                      expect(semaphoreBefore).toBe(semaphoreContract.address)
                  })

                  it('should have setup mixAmt', async () => {
                      const mixAmtBefore = await mixerContract.mixAmt()
                      expect(mixAmtBefore.eq(mixAmtToken)).toBeTruthy()
                  })



                  it('should perform a deposit', async () => {

                      const identity = identities[users[0]]
                      const identityCommitment = genIdentityCommitment(identity)

                      let balanceBefore
                      if (isETH){
                          balanceBefore = await wallet.provider.getBalance(depositorAddress)
                      } else {
                          balanceBefore = await tokenContract.balanceOf(depositorAddress)
                      }
                      expect(balanceBefore.gte(mixAmtToken)).toBeTruthy()

                      // make a deposit
                      const receipt = await performeDeposit(isETH, identityCommitment, mixAmtToken, mixerContract, tokenContract)

                      const gasUsed = receipt.gasUsed
                      console.log('Gas used for this deposit:', gasUsed.toString())

                      // check that the leaf was added to the leaf history array in the contract
                      const leaves = (await mixerContract.getLeaves()).map((x) => {
                          return x.toString()
                      })
                      expect(leaves.toString()).toMatch(identityCommitment.toString())

                      let balanceAfter
                      if (isETH){
                          balanceAfter = await wallet.provider.getBalance(depositorAddress)
                      } else {
                          balanceAfter = await tokenContract.balanceOf(depositorAddress)
                      }
                      expect(balanceBefore.sub(balanceAfter).gte(mixAmtToken)).toBeTruthy()
                  })

                  it('should make a withdrawal', async () => {

                      const identity = identities[users[0]]
                      const identityCommitment = genIdentityCommitment(identity)



                      // make a deposit
                      await performeDeposit(isETH, identityCommitment, mixAmtToken, mixerContract, tokenContract)

                      // get the circuit, verifying key, and proving key
                      const { verifyingKey, provingKey, circuit } = await getSnarks()

                      expect(circuit).toBeTruthy();
                      expect(verifyingKey).toBeTruthy();
                      expect(provingKey).toBeTruthy();

                      let recipientBalanceBefore
                      let recipientBalanceAfter
                      let recipientBalanceDiff

                      let relayerBalanceBefore
                      let relayerBalanceAfter
                      let relayerBalanceDiff

                      let leaves

                      leaves = await mixerContract.getLeaves()
                      expect(leaves).toBeTruthy()

                      //console.log(leaves)

                      externalNullifier = mixerContract.address

                      const {
                          witness,
                          signal,
                          signalHash,
                          signature,
                          msg,
                          tree,
                          identityPath,
                          identityPathIndex,
                          identityPathElements,
                      } = await genMixerWitness(
                          circuit,
                          identity,
                          leaves,
                          20,
                          recipientAddress,
                          relayerAddress,
                          feeAmt,
                          externalNullifier,
                      )

                      //Return boolen
                      expect(await verifySignature(msg, signature, identity.keypair.pubKey)).toBeTruthy()
                      expect(await circuit.checkWitness(witness)).toBeTruthy()

                      //Return SnarkPublicSignals
                      const publicSignals = await genPublicSignals(witness, circuit)
                      expect(publicSignals).toBeTruthy()

                      //Return async + Promise
                      const proof = await await genProof(witness, provingKey)
                      //console.log(proof)
                      expect(proof).toBeTruthy()

                      //Return boolen
                      expect(await verifyProof(verifyingKey, proof, publicSignals)).toBeTruthy()

                      const mixInputs = await genDepositProof(
                          signal,
                          proof,
                          publicSignals,
                          recipientAddress,
                          feeAmt,
                      )
                      expect(mixInputs).toBeTruthy()

                      //console.log(mixInputs)
                      //console.log(ethers.BigNumber.from(signalHash))
                      const preBroadcastChecked = await semaphoreContract.preBroadcastCheck(
                          mixInputs.a,
                          mixInputs.b,
                          mixInputs.c,
                          mixInputs.input,
                          ethers.BigNumber.from(signalHash),
                      )
                      /* debug for invalid proof
                      if (!preBroadcastChecked){
                          const preBroadcastCheckedDetect = await semaphoreContract.preBroadcastCheckDetect(
                              mixInputs.a,
                              mixInputs.b,
                              mixInputs.c,
                              mixInputs.input,
                              ethers.BigNumber.from(signalHash),
                          )
                          console.log("preBroadcastCheckedDetect", preBroadcastCheckedDetect)
                      }
                      */
                      //console.log(preBroadcastChecked)
                      //todo fix
                      expect(preBroadcastChecked).toBeTruthy()

                      let mixTx

                      if (isETH){

                          recipientBalanceBefore = ethers.BigNumber.from(await wallet.provider.getBalance(recipientAddress))
                          relayerBalanceBefore = ethers.BigNumber.from(await wallet.provider.getBalance(relayerAddress))

                          mixTx = await mix(
                              relayerRegistryContract,
                              mixerContract,
                              signal,
                              proof,
                              publicSignals,
                              recipientAddress,
                              feeAmt,
                              relayerAddress,
                          )
                      } else {

                          recipientBalanceBefore = ethers.BigNumber.from(await tokenContract.balanceOf(recipientAddress))
                          relayerBalanceBefore = ethers.BigNumber.from(await tokenContract.balanceOf(relayerAddress))

                          mixTx = await mixERC20(
                              relayerRegistryContract,
                              mixerContract,
                              signal,
                              proof,
                              publicSignals,
                              recipientAddress,
                              feeAmt,
                              relayerAddress,
                          )
                      }

                      const mixReceipt = await mixTx.wait()
                      expect(mixReceipt.events).toBeTruthy()

                      if (isETH){
                          recipientBalanceAfter = ethers.BigNumber.from(await wallet.provider.getBalance(recipientAddress))
                          relayerBalanceAfter = ethers.BigNumber.from(await wallet.provider.getBalance(relayerAddress))
                      } else {
                          recipientBalanceAfter = ethers.BigNumber.from(await tokenContract.balanceOf(recipientAddress))
                          relayerBalanceAfter = ethers.BigNumber.from(await tokenContract.balanceOf(relayerAddress))
                      }
                      const gasUsed = mixReceipt.gasUsed.toString()
                      console.log('Gas used for this withdrawal:', gasUsed)

                      relayerBalanceDiff = relayerBalanceAfter.sub(relayerBalanceBefore)
                      expect(relayerBalanceDiff.eq(feeAmt)).toBeTruthy()
                      recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore)
                      expect(recipientBalanceDiff.add(feeAmt).eq(mixAmtToken)).toBeTruthy()
                  })
              })
          })
      }
  }
}
