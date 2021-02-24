require('module-alias/register')
// Make Typescript happy
declare var assert: any
declare var before: any
require('events').EventEmitter.defaultMaxListeners = 0

const path = require('path');
import * as etherlime from 'etherlime-lib'
import * as ethers from 'ethers'

import { config } from 'mixer-config'
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
import buildMiMC from '../buildMiMC'
const Mixer = require('@mixer-contracts/compiled/Mixer.json')
const ERC20Mintable = require('@mixer-contracts/compiled/ERC20Mintable.json')

import {
    deployAllContracts,
} from '../deploy/deploy'

for (let configNetworkName of Object.keys(config.get('network-test'))) {
  console.log("Test network:", configNetworkName);
  let configNetwork = config.get('network-test.' + configNetworkName)

  if (!(configNetwork.has('disable'))){

      for (let configTokenName of Object.keys(configNetwork.get('token'))) {
          console.log("Test token:", configTokenName);
          let configToken = configNetwork.get('token.' + configTokenName)

          const accounts = genAccounts(configNetwork)
          assert(accounts[0], "Account 0 for deposit is not set")
          const depositorAddress = accounts[0].address
          assert(accounts[1], "Account 1 for recipient is not set")
          const recipientAddress = accounts[1].address
          assert(accounts[2], "Account 2 for relayer is not set")
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

          mixAmtToken = ethers.utils.bigNumberify((configToken.get('mixAmt') * (10 ** decimals)).toString())
          feeAmt = ethers.utils.bigNumberify((configToken.get('feeAmt') * (10 ** decimals)).toString())

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

          describe(configNetworkName + '.' + configTokenName + ' Mixer', () => {

              const deployer = new etherlime.JSONRPCPrivateKeyDeployer(
                  accounts[0].privateKey,
                  configNetwork.get('url'),
                  {
                      chainId: configNetwork.get('chainId'),
                  },
              )
              deployer.defaultOverrides = { gasLimit: 8800000 }
              deployer.setSigner(accounts[0])

              before(async () => {
                  await buildMiMC()

                  const contracts = await deployAllContracts(
                      deployer,
                      configToken,
                      depositorAddress,
                      null,
                      null,
                  )
                  mimcContract = contracts.mimcContract
                  semaphoreContract = contracts.semaphoreContract
                  mixerContract = contracts.mixerContract
                  relayerRegistryContract = contracts.relayerRegistryContract
                  tokenContract = contracts.tokenContract

                  // mint tokens
                  // await tokenContract.mint(depositorAddress, '100000000000000000000000')

              })

              describe('Contract deployments', () => {
                  
                  it('should not deploy Mixer if the Semaphore contract address is invalid', async () => {
                      assert.revert(
                          deployer.deploy(
                              Mixer,
                              {},
                              '0x0000000000000000000000000000000000000000',
                              mixAmtToken,
                              '0x0000000000000000000000000000000000000000',
                          )
                      )
                      await sleep(1000)
                  })

                  it('should not deploy mixer if the mixAmt is invalid', async () => {
                      assert.revert(
                          deployer.deploy(
                              Mixer,
                              {},
                              semaphoreContract.contractAddress,
                              ethers.utils.parseEther('0'),
                              '0x0000000000000000000000000000000000000000',
                          )
                      )
                      await sleep(1000)
                  })

                  it('should deploy contracts', () => {
                      assert.notEqual(
                          mimcContract._contract.bytecode,
                          '0x',
                          'the contract bytecode should not just be 0x'
                      )

                      assert.isAddress(mimcContract.contractAddress)
                      assert.isAddress(semaphoreContract.contractAddress)
                      assert.isAddress(mixerContract.contractAddress)

                      // the external nullifier is the hash of the contract's address
                      externalNullifier = mixerContract.contractAddress
                  })

                  it('the Mixer contract should be the owner of the Semaphore contract', async () => {
                      assert.equal((await semaphoreContract.owner()), mixerContract.contractAddress)
                  })

                  it('the Semaphore contract\'s external nullifier should be the mixer contract address', async () => {
                      const semaphoreExtNullifier = await semaphoreContract.getExternalNullifierByIndex(1)
                      const mixerAddress = mixerContract.contractAddress
                      assert.isTrue(areEqualAddresses(semaphoreExtNullifier, mixerAddress))
                  })
              })

              describe('Deposits and withdrawals', () => {
                  // get the circuit, verifying key, and proving key
                  const { verifyingKey, provingKey, circuit } = getSnarks()

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

                      it('should not add the identity commitment to the contract if the amount is incorrect', async () => {
                          await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: 0 }))

                          const invalidValue = (BigInt(mixAmtToken) + BigInt(1)).toString()
                          await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: invalidValue }))
                      })


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
                          assert.ok(reason == 'Mixer: only supports tokens' || reason == 'transaction failed', "Transaction should have given error message insteand of" + reason)
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
                          assert.ok(reason == 'Mixer: only supports ETH' || reason == 'transaction failed', "Transaction should have given error message insteand of" + reason)
                      })
                  }


                  it('should have setup semaphore', async () => {
                      const semaphoreBefore = await mixerContract.semaphore()
                      assert.equal(semaphoreBefore, semaphoreContract.contractAddress, "Semaphore is not set")
                  })

                  it('should have setup mixAmt', async () => {
                      const mixAmtBefore = await mixerContract.mixAmt()
                  })

                  it('should perform a deposit', async () => {
                      let balanceBefore
                      if (isETH){
                          balanceBefore = await deployer.provider.getBalance(depositorAddress)
                      } else {
                          await tokenContract.approve(
                              mixerContract.contractAddress,
                              mixAmtToken,
                          )

                          balanceBefore = await tokenContract.balanceOf(depositorAddress)
                      }

                      assert.isTrue(balanceBefore > 0)

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
                      assert.isTrue(utils.hasEvent(receipt, semaphoreContract.contract, 'LeafAdded'))
                      const leafAddedEvent = utils.parseLogs(receipt, semaphoreContract.contract, 'LeafAdded')[0]

                      nextIndex = leafAddedEvent.leaf_index
                      assert.equal(nextIndex, 0)

                      // check that the leaf was added to the leaf history array in the contract
                      const leaves = (await mixerContract.getLeaves()).map((x) => {
                          return x.toString(10)
                      })
                      assert.include(leaves, identityCommitment.toString())

                      let balanceAfter
                      if (isETH){
                          balanceAfter = await deployer.provider.getBalance(depositorAddress)
                          assert.isTrue(
                              balanceBefore.sub(balanceAfter) >= mixAmtToken,
                          )
                      }else{
                          balanceAfter = await tokenContract.balanceOf(depositorAddress)
                          assert.equal(
                              balanceBefore.sub(balanceAfter).toString(),
                              mixAmtToken.toString(),
                          )
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

                      assert.isTrue(verifySignature(msg, signature, identity.keypair.pubKey))

                      assert.isTrue(circuit.checkWitness(witness))

                      const publicSignals = genPublicSignals(witness, circuit)

                      const proof = await genProof(witness, provingKey)

                      // verify the proof off-chain
                      const isVerified = verifyProof(verifyingKey, proof, publicSignals)
                      assert.isTrue(isVerified)

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

                      assert.isTrue(preBroadcastChecked)


                      let mixTx

                      if (isETH){

                          recipientBalanceBefore = await deployer.provider.getBalance(recipientAddress)
                          relayerBalanceBefore = await deployer.provider.getBalance(relayerAddress)


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
                          recipientBalanceAfter = await deployer.provider.getBalance(recipientAddress)
                          relayerBalanceAfter = await deployer.provider.getBalance(relayerAddress)
                      } else {
                          recipientBalanceAfter = await tokenContract.balanceOf(recipientAddress)
                          relayerBalanceAfter = await tokenContract.balanceOf(relayerAddress)
                      }

                      const gasUsed = mixReceipt.gasUsed.toString()
                      console.log('Gas used for this withdrawal:', gasUsed)
                  })

                  it('should increase the relayer\'s token balance', () => {
                      relayerBalanceDiff = relayerBalanceAfter.sub(relayerBalanceBefore)
                      assert.equal(relayerBalanceDiff.toString(), feeAmt.toString())
                  })

                  it('should increase the recipient\'s token balance', () => {
                      recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore)
                      assert.equal(
                          recipientBalanceDiff.add(feeAmt).toString(),
                          mixAmtToken,
                      )
                  })
              })
          })
      }
  }
}
