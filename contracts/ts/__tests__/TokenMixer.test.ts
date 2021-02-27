require('module-alias/register')
require('events').EventEmitter.defaultMaxListeners = 0

const path = require('path');
import * as ethers from 'ethers'

import { configMixer } from 'mixer-config'
import {
    mix,
    mixERC20,
    genDepositProof,
    areEqualAddresses,
    getSnarks,
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

for (let configNetworkName of Object.keys(configMixer.get('network-test'))) {
  console.log("Test network:", configNetworkName);
  let configNetwork = configMixer.get('network-test.' + configNetworkName)

  if (!(configNetwork.has('disable'))){

      for (let configTokenName of Object.keys(configNetwork.get('token'))) {
          console.log("Test token:", configTokenName);
          let configToken = configNetwork.get('token.' + configTokenName)

          describe(configNetworkName + '.' + configTokenName + ' Mixer', () => {

              const accounts = genAccounts(configNetwork)
              expect(accounts[0]).toBeTruthy();
              const depositorAddress = accounts[0].address
              expect(accounts[1]).toBeTruthy();
              const recipientAddress = accounts[1].address
              expect(accounts[2]).toBeTruthy();
              let relayerAddress = accounts[2].address


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
              let wallet

              wallet = getWallet(configNetwork.get('url'), accounts[0].privateKey)
              expect(wallet).toBeTruthy()

              beforeAll( done =>  {
                  console.log("start0")
                  const func_async = (async () => {
                      console.log("start")
                      const contracts = await deployAllContracts(
                          wallet,
                          configToken,
                          depositorAddress,
                          null,
                          null,
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
                      console.log("to done")
                      done()
                      console.log("done")
                  })

                  func_async()
                  //expect(semaphoreContract).toBeTruthy()
              })


              describe('Contract deployments', () => {
                  /*
                  it('should not deploy Mixer if the Semaphore contract address is invalid', async () => {
                      assert.revert(
                          deployContract(wallet,
                              Mixer,
                              '0x0000000000000000000000000000000000000000',
                              mixAmtToken,
                              '0x0000000000000000000000000000000000000000',
                          )
                      )
                      await sleep(1000)
                  })

                  it('should not deploy mixer if the mixAmt is invalid', async () => {
                      assert.revert(
                          deployContract(wallet,
                              Mixer,
                              semaphoreContract.address,
                              ethers.utils.parseEther('0'),
                              '0x0000000000000000000000000000000000000000',
                          )
                      )
                      await sleep(1000)
                  })

                  it('should deploy contracts', () => {
                      expect(mimcContract._contract.bytecode).not.toBe('0x')

                      assert.isAddress(mimcContract.address)
                      assert.isAddress(semaphoreContract.address)
                      assert.isAddress(mixerContract.address)

                      // the external nullifier is the hash of the contract's address
                      externalNullifier = mixerContract.address
                  })
                  */
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
                  // get the circuit, verifying key, and proving key
                  const { verifyingKey, provingKey, circuit } = getSnarks()

                  expect(circuit).toBeTruthy();
                  expect(verifyingKey).toBeTruthy();
                  expect(provingKey).toBeTruthy();

                  const identity = identities[users[0]]
                  const identityCommitment = genIdentityCommitment(identity)
                  let nextIndex

                  let recipientBalanceBefore
                  let recipientBalanceAfter
                  let recipientBalanceDiff

                  let relayerBalanceBefore
                  let relayerBalanceAfter
                  let relayerBalanceDiff

                  let mixReceipt

                  if (isETH){
                      /*
                      it('should not add the identity commitment to the contract if the amount is incorrect', async () => {
                          await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: 0 }))

                          const invalidValue = (BigInt(mixAmtToken) + BigInt(1)).toString()
                          await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: invalidValue }))
                      })
                      */

                      it('should fail to call depositERC20() (which is not ETH)', async () => {
                          let reason: string = ''
                          let tx
                          try {
                              tx = await mixerContract.depositERC20('0x' + identityCommitment.toString(16), { gasLimit: 1500000 })
                              const receipt = await mixerContract.verboseWaitForTransaction(tx)
                          } catch (err) {
                              try{
                                  reason = err.data[err.transactionHash].reason
                              }catch (err2){
                                  reason = err.reason
                              }

                          }
                          expect(reason == 'Mixer: only supports tokens' || reason == 'transaction failed').toBeTruthy()
                      })
                  } else {
                      it('should fail to call deposit() (which is for ETH only)', async () => {
                          let reason: string = ''
                          let tx
                          try {
                              tx = await mixerContract.deposit('0x' + identityCommitment.toString(16), { gasLimit: 1500000 })
                              const receipt = await mixerContract.verboseWaitForTransaction(tx)
                          } catch (err) {
                              try{
                                  reason = err.data[err.transactionHash].reason
                              }catch (err2){
                                  reason = err.reason
                              }

                          }
                          expect(reason == 'Mixer: only supports ETH' || reason == 'transaction failed').toBeTruthy()
                      })
                  }

                  it('should have setup semaphore', async () => {
                      const semaphoreBefore = await mixerContract.semaphore()
                      expect(semaphoreBefore).toBe(semaphoreContract.address)
                  })

                  it('should have setup mixAmt', async () => {
                      const mixAmtBefore = await mixerContract.mixAmt()
                  })

                  it('should perform a deposit', async () => {
                      let balanceBefore
                      if (isETH){
                          balanceBefore = ethers.BigNumber.from(await wallet.provider.getBalance(depositorAddress))
                          expect( parseFloat(ethers.utils.formatEther(balanceBefore))).toBeGreaterThan(0)
                      } else {
                          await tokenContract.approve(
                              mixerContract.address,
                              mixAmtToken,
                          )

                          balanceBefore = await tokenContract.balanceOf(depositorAddress)
                          expect(balanceBefore).toBeGreaterThan(0)
                      }

                      // make a deposit
                      let tx
                      if (isETH){
                          tx = await mixerContract.deposit(
                              '0x' + identityCommitment.toString(16),
                              {value: '0x' + BigInt(mixAmtToken).toString(16),
                               gasLimit: 1500000 })
                      } else {
                          tx = await mixerContract.depositERC20('0x' + identityCommitment.toString(16), { gasLimit: 1500000 })
                      }

                      const receipt = await mixerContract.verboseWaitForTransaction(tx)

                      const gasUsed = receipt.gasUsed
                      console.log('Gas used for this deposit:', gasUsed.toString())

                      // check that the leaf was added using the receipt
                      expect(utils.hasEvent(receipt, semaphoreContract.contract, 'LeafAdded')).toBeTruthy()
                      const leafAddedEvent = utils.parseLogs(receipt, semaphoreContract.contract, 'LeafAdded')[0]

                      nextIndex = leafAddedEvent.leaf_index
                      expect(nextIndex).toBe(0)

                      // check that the leaf was added to the leaf history array in the contract
                      const leaves = (await mixerContract.getLeaves()).map((x) => {
                          return x.toString(10)
                      })
                      expect(leaves).toMatch(identityCommitment.toString())

                      let balanceAfter
                      if (isETH){
                          balanceAfter = await wallet.provider.getBalance(depositorAddress)
                          expect(balanceBefore.sub(balanceAfter)).toBeGreaterThanOrEqual(mixAmtToken)
                      } else {
                          balanceAfter = await tokenContract.balanceOf(depositorAddress)
                          expect(balanceBefore.sub(balanceAfter)).toEqual(mixAmtToken)
                      }


                  })

                  it('should make a withdrawal', async () => {
                      const leaves = await mixerContract.getLeaves()

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

                      expect(verifySignature(msg, signature, identity.keypair.pubKey)).toBeTruthy()

                      expect(circuit.checkWitness(witness)).toBeTruthy()

                      const publicSignals = genPublicSignals(witness, circuit)

                      const proof = await genProof(witness, provingKey)

                      // verify the proof off-chain
                      const isVerified = verifyProof(verifyingKey, proof, publicSignals)
                      expect(isVerified).toBeTruthy()

                      const mixInputs = await genDepositProof(
                          signal,
                          proof,
                          publicSignals,
                          recipientAddress,
                          feeAmt,
                      )

                      // check inputs to mixERC20() using preBroadcastCheck()
                      const preBroadcastChecked = await semaphoreContract.preBroadcastCheck(
                          mixInputs.a,
                          mixInputs.b,
                          mixInputs.c,
                          mixInputs.input,
                          signalHash.toString(),
                      )

                      expect(preBroadcastChecked).toBeTruthy()


                      let mixTx

                      if (isETH){

                          recipientBalanceBefore = await wallet.provider.getBalance(recipientAddress)
                          relayerBalanceBefore = await wallet.provider.getBalance(relayerAddress)


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

                          recipientBalanceBefore = await tokenContract.balanceOf(recipientAddress)
                          relayerBalanceBefore = await tokenContract.balanceOf(relayerAddress)

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


                      // Wait till the transaction is mined
                      mixReceipt = await mixerContract.verboseWaitForTransaction(mixTx)

                      if (isETH){
                          recipientBalanceAfter = await wallet.provider.getBalance(recipientAddress)
                          relayerBalanceAfter = await wallet.provider.getBalance(relayerAddress)
                      } else {
                          recipientBalanceAfter = await tokenContract.balanceOf(recipientAddress)
                          relayerBalanceAfter = await tokenContract.balanceOf(relayerAddress)
                      }

                      const gasUsed = mixReceipt.gasUsed.toString()
                      console.log('Gas used for this withdrawal:', gasUsed)
                  })

                  it('should increase the relayer\'s token balance', () => {
                      relayerBalanceDiff = relayerBalanceAfter.sub(relayerBalanceBefore)
                      expect(relayerBalanceDiff).toEqual(feeAmt)
                  })

                  it('should increase the recipient\'s token balance', () => {
                      recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore)
                      expect(recipientBalanceDiff.add(feeAmt)).toEqual(mixAmtToken)
                  })
              })
          })
      }
  }
}
