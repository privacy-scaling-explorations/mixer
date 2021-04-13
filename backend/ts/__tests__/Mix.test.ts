require('module-alias/register')
declare var assert: any
import { createApp } from '../index'
const Koa = require('koa')
import * as ethers from 'ethers'
import axios from 'axios'
import * as JsonRpc from '../jsonRpc'
const fs = require('fs');
const path = require('path');
import { sleep, genMixParams } from 'mixer-utils'
import * as errors from '../errors'
import { getContract } from 'mixer-contracts'
import {
    parseVerifyingKeyJson,
    genCircuit,
    genIdentity,
    genIdentityCommitment,
    genMixerWitness,
    genProof,
    verifyProof,
    verifySignature,
    genPublicSignals,
} from 'libsemaphore'
import {
    backendPort,
    backendHost,
} from '../utils/configBackend'

import {
    getTestParam,
    getBackendAddress,
} from '../utils/configBackendNetwork'

import {
    getMixerList
} from 'mixer-contracts'

import { post } from './utils'

const network = 'ganache'
const token = 'eth'

const {
    isETH,
    tokenDecimals,
    feeAmt,
    chainId,
    chainUrl,
    privateKeysPath,
    tokenAddress,
    forwarderRegistryERC20Address,
} = getTestParam(network, token)

jest.setTimeout(90000)

const PORT = backendPort
const HOST = backendHost + ':' + backendPort.toString()

const provingKey = fs.readFileSync(
    path.join(__dirname, '../../../semaphore/semaphorejs/build/proving_key.bin'),
)

const verifyingKey = parseVerifyingKeyJson(fs.readFileSync(
    path.join(
        __dirname,
        '../../../semaphore/semaphorejs/build/verification_key.json',
    )
))

const circuitPath = '../../../semaphore/semaphorejs/build/circuit.json'
const cirDef = JSON.parse(
    fs.readFileSync(path.join(__dirname, circuitPath)).toString()
)
const circuit = genCircuit(cirDef)

let validParamsForEth
let validParamsForTokens

const schemaInvalidParamsForEth = {
    networkName: network,
    mixer: '0x2bD9aAa2953F988153c8629926D22A6a5F69b14E',
    signal: 'INVALID<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
    a: ['0x0', '0x0'],
    b: [
        ['0x0', '0x0'],
        ['0x0', '0x0'],
    ],
    c: ['0x0', '0x0'],
    input: ['0x0', '0x0', '0x0', '0x0', '0x0'],
    recipientAddress: '0x2bD9aAa2953F988153c8629926D22A6a5F69b14E',
    fee: '0',
}

let server
const recipientAddress = '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef'

let provider
let signer
let mixerAddress
let mixAmtWei
let feeAmtWei
let mixerContract
let tokenContract

describe('the mixer_mix_eth API call', () => {

    beforeAll(async () => {
        const app = createApp()
        server = app.listen(PORT)

        provider = new ethers.providers.JsonRpcProvider(
            chainUrl,
            chainId,
        )

        const testingPrivKeys = require("../../../" + privateKeysPath)

        signer = new ethers.Wallet(
            testingPrivKeys[0],
            provider,
        )

        const mixerList = await getMixerList(signer, tokenAddress)
        expect(mixerList).toBeTruthy()
        expect(mixerList.length).toBeGreaterThan(0)
        mixAmtWei = mixerList[0].mixAmt
        mixerAddress = mixerList[0].address

        feeAmtWei = ethers.utils.parseUnits(feeAmt.toString(), tokenDecimals)

        mixerContract = getContract(
            'Mixer',
            signer,
            mixerAddress,
        )

        if (!isETH){
            tokenContract = getContract(
                'Token',
                signer,
                tokenAddress,
                'ERC20Mintable',
            )
        }
        console.log("depositAddress", signer.address)
        console.log("backendAddress", await getBackendAddress(network))
        console.log("recipientAddress", recipientAddress)


    })

    if (isETH){
        test('accepts a valid proof to mix ETH and credits the recipient', async () => {
            // generate an identityCommitment
            const backendAddress = await getBackendAddress(network)
            const relayerAddress = forwarderRegistryERC20Address
            const identity = genIdentity()
            const identityCommitment = genIdentityCommitment(identity)
            const tx = await mixerContract.deposit(
                '0x' + identityCommitment.toString(16),
                {
                    value: mixAmtWei,
                    //gasLimit: 1500000
                }
            )
            const receipt = await tx.wait()
            expect(receipt.status).toEqual(1)
            expect(receipt.events).toBeTruthy()
            expect(receipt.events[receipt.events.length - 1].event).toMatch('Deposited')


            // generate withdrawal proof

            const leaves = await mixerContract.getLeaves()
            const externalNullifier = mixerContract.address

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
                feeAmtWei,
                externalNullifier,
            )

            const publicSignals = genPublicSignals(witness, circuit)

            const proof = await genProof(witness, provingKey)

            const isVerified = verifyProof(verifyingKey, proof, publicSignals)
            expect(isVerified).toBeTruthy()

            const params = genMixParams(
                network,
                mixerAddress,
                signal,
                proof,
                recipientAddress,
                feeAmtWei,
                publicSignals,
            )

            validParamsForEth = params

            //console.log("validParamsForEth", validParamsForEth)

            const recipientBalanceBefore = await provider.getBalance(recipientAddress)
            const backendBalanceBefore = await provider.getBalance(backendAddress)

            // make the API call to submit the proof
            const resp = await post(1, 'mixer_mix_eth', params)

            if (resp.data.error) {
                console.log(params)
                console.error(resp.data.error)
            }

            expect(resp.data.result.txHash).toMatch(/^0x[a-fA-F0-9]{40}/)

            // wait for the tx to be mined
            let receipt2
            while (true) {
                receipt2 = await provider.getTransactionReceipt(resp.data.result.txHash)
                if (receipt2 == null) {
                    await sleep(1000)
                } else {
                    break
                }
            }

            const tx2 = await provider.getTransaction(resp.data.result.txHash)

            const recipientBalanceAfter = await provider.getBalance(recipientAddress)
            const backendBalanceAfter = await provider.getBalance(backendAddress)
            expect(recipientBalanceAfter.sub(recipientBalanceBefore))
                .toEqual(mixAmtWei.sub(feeAmtWei))
            expect(backendBalanceAfter.sub(backendBalanceBefore).toString())
                .toEqual(feeAmtWei.sub(receipt2.gasUsed.mul(tx2.gasPrice)).toString())
        })
    }else{
        test('accepts a valid proof to mix tokens and credits the recipient', async () => {
            const backendAddress = await getBackendAddress(network)
            const relayerAddress = forwarderRegistryERC20Address
            // mint tokens for the sender
            await tokenContract.mint(
                signer.address,
                mixAmtWei,
                //{ gasLimit: 100000, }
            )
            await tokenContract.approve(
                mixerContract.address,
                mixAmtWei,
                //{ gasLimit: 100000, }
            )

            // generate an identityCommitment
            const identity = genIdentity()
            const identityCommitment = genIdentityCommitment(identity)

            console.log("mixAmtWei", mixAmtWei.toString(), (await mixerContract.mixAmt()).toString())

            const tx = await mixerContract.depositERC20(
                identityCommitment.toString(),
                //{ gasLimit: 1500000, }
            )
            const receipt = await tx.wait()

            expect(receipt.status).toEqual(1)

            const leaves = await mixerContract.getLeaves()
            const externalNullifier = mixerContract.address

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
                feeAmtWei,
                externalNullifier,
            )

            const publicSignals = genPublicSignals(witness, circuit)

            const proof = await genProof(witness, provingKey)

            const isVerified = verifyProof(verifyingKey, proof, publicSignals)
            expect(isVerified).toBeTruthy()
            const params = genMixParams(
                network,
                mixerAddress,
                signal,
                proof,
                recipientAddress,
                feeAmtWei,
                publicSignals,
            )

            validParamsForTokens = params

            const recipientBalanceBefore = await tokenContract.balanceOf(recipientAddress)
            const backendBalanceBefore = await tokenContract.balanceOf(backendAddress)

            // make the API call to submit the proof
            const resp = await post(1, 'mixer_mix_tokens', params)

            if (resp.data.error) {
                console.log(params)
                console.error(resp.data.error)
            }

            expect(resp.data.result.txHash).toMatch(/^0x[a-fA-F0-9]{40}/)

            // wait for the tx to be mined
            while (true) {
                const receipt = await provider.getTransactionReceipt(resp.data.result.txHash)
                if (receipt == null) {
                    await sleep(1000)
                } else {
                    break
                }
            }

            const recipientBalanceAfter = await tokenContract.balanceOf(recipientAddress)
            const backendBalanceAfter = await tokenContract.balanceOf(backendAddress)
            const diff = recipientBalanceAfter.sub(recipientBalanceBefore).toString()
            expect(diff)
                .toEqual(mixAmtWei.sub(feeAmtWei).toString())
            expect(backendBalanceAfter.sub(backendBalanceBefore).toString())
                .toEqual(feeAmtWei.toString())
        })

    }

    test('check if we use the right mixer', async () => {
        expect(mixAmtWei.eq(await mixerContract.mixAmt())).toBeTruthy()
    })

    if (isETH){
        test('rejects a request where the JSON-RPC schema is invalid', async () => {
            const resp = await post(1, 'mixer_mix_eth', schemaInvalidParamsForEth)

            expect(resp.data.error.code).toEqual(JsonRpc.Errors.invalidParams.code)
        })

        test('rejects a proof where the signal is invalid', async () => {
            // deep copy and make the signal invalid
            const signalInvalidParamsForEth = JSON.parse(JSON.stringify(validParamsForEth))
            signalInvalidParamsForEth.signal = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

            const resp = await post(1, 'mixer_mix_eth', signalInvalidParamsForEth)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_INVALID)
        })
        test('rejects a proof where the signal hash is invalid', async () => {
            // deep copy and make the signal hash invalid
            const signalHashInvalidParamsForEth = JSON.parse(JSON.stringify(validParamsForEth))
            signalHashInvalidParamsForEth.input[2] = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

            const resp = await post(1, 'mixer_mix_eth', signalHashInvalidParamsForEth)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_HASH_INVALID)
        })

        test('rejects a proof where both the signal and the signal hash are invalid', async () => {
            // deep copy and make both the signal and the signal hash invalid
            const signalAndSignalHashInvalidParamsForEth = JSON.parse(JSON.stringify(validParamsForEth))
            signalAndSignalHashInvalidParamsForEth.signal = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            signalAndSignalHashInvalidParamsForEth.input[2] = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

            const resp = await post(1, 'mixer_mix_eth', signalAndSignalHashInvalidParamsForEth)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_AND_SIGNAL_HASH_INVALID)
        })

        test('rejects a proof where the external nullifier is invalid', async () => {
            // deep copy and make the external nullifier invalid
            const externalNullifierInvalidParamsForEth = JSON.parse(JSON.stringify(validParamsForEth))
            externalNullifierInvalidParamsForEth.input[3] = '0x0000000000000000000000000000000000000000'

            const resp = await post(1, 'mixer_mix_eth', externalNullifierInvalidParamsForEth)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_EXTERNAL_NULLIFIER_INVALID)
        })
    } else {


        test('rejects a proof where the signal is invalid', async () => {
            // deep copy and make the signal invalid
            const signalInvalidParamsForTokens = JSON.parse(JSON.stringify(validParamsForTokens))
            signalInvalidParamsForTokens.signal = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

            const resp = await post(1, 'mixer_mix_tokens', signalInvalidParamsForTokens)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_INVALID)
        })
        test('rejects a proof where the signal hash is invalid', async () => {
            // deep copy and make the signal hash invalid
            const signalHashInvalidParamsForTokens = JSON.parse(JSON.stringify(validParamsForTokens))
            signalHashInvalidParamsForTokens.input[2] = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

            const resp = await post(1, 'mixer_mix_tokens', signalHashInvalidParamsForTokens)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_HASH_INVALID)
        })

        test('rejects a proof where both the signal and the signal hash are invalid', async () => {
            // deep copy and make both the signal and the signal hash invalid
            const signalAndSignalHashInvalidParamsForTokens = JSON.parse(JSON.stringify(validParamsForTokens))
            signalAndSignalHashInvalidParamsForTokens.signal = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            signalAndSignalHashInvalidParamsForTokens.input[2] = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

            const resp = await post(1, 'mixer_mix_tokens', signalAndSignalHashInvalidParamsForTokens)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_AND_SIGNAL_HASH_INVALID)
        })

        test('rejects a proof where the external nullifier is invalid', async () => {
            // deep copy and make the external nullifier invalid
            const externalNullifierInvalidParamsForTokens = JSON.parse(JSON.stringify(validParamsForTokens))
            externalNullifierInvalidParamsForTokens.input[3] = '0x0000000000000000000000000000000000000000'

            const resp = await post(1, 'mixer_mix_tokens', externalNullifierInvalidParamsForTokens)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_EXTERNAL_NULLIFIER_INVALID)
        })
    }

    if (!isETH){
        test('rejects a proof where the token fee is too low', async () => {
            // deep copy and make the fee too low
            const lowFeeProof = JSON.parse(JSON.stringify(validParamsForTokens))
            lowFeeProof.fee = '0'

            const resp = await post(1, 'mixer_mix_tokens', lowFeeProof)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_INSUFFICIENT_TOKEN_FEE)
        })
    }else{
        test('rejects a proof where the ETH fee is too low', async () => {
            // deep copy and make the fee too low
            const lowFeeProof = JSON.parse(JSON.stringify(validParamsForEth))
            lowFeeProof.fee = ethers.utils.parseEther('0.00001').toString()

            const resp = await post(1, 'mixer_mix_eth', lowFeeProof)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_INSUFFICIENT_ETH_FEE)
        })
    }

    afterAll(async () => {
        server.close()
    })
})
