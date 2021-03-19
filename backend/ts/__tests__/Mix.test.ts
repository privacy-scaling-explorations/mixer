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
    getRelayerAddress,
} from '../utils/configBackendNetwork'

import { post } from './utils'

const network = 'ganache'
const token = 'eth'

const {
    isETH,
    mixAmt,
    tokenDecimals,
    feeAmt,
    chainId,
    chainUrl,
    privateKeysPath,
    mixerAddress,
    tokenAddress,
} = getTestParam(network, token)

jest.setTimeout(90000)

const PORT = backendPort
const HOST = backendHost + ':' + backendPort.toString()

const depositAmtEth = ethers.utils.parseEther(mixAmt.toString())

const feeAmtWei = ethers.utils.parseEther(feeAmt.toString())

const provider = new ethers.providers.JsonRpcProvider(
    chainUrl,
    chainId,
)

const testingPrivKeys = require("../" + privateKeysPath)

const signer = new ethers.Wallet(
    testingPrivKeys[0],
    provider,
)

const mixerContract = getContract(
    'Mixer',
    signer,
    mixerAddress,
)

let tokenContract

if (!isETH){
    tokenContract = getContract(
        'Token',
        signer,
        tokenAddress,
        'ERC20Mintable',
    )
}

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
    fee: '0x0',
}

let server
const recipientAddress = '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef'

describe('the mixer_mix_eth API call', () => {
    let recipientBalanceBefore
    let recipientBalanceAfter

    beforeAll(async () => {
        const app = createApp()
        server = app.listen(PORT)
    })



    if (isETH){
        test('accepts a valid proof to mix ETH and credits the recipient', async () => {
            // generate an identityCommitment
            const relayerAddress = await getRelayerAddress(network)
            const identity = genIdentity()
            const identityCommitment = genIdentityCommitment(identity)

            const tx = await mixerContract.deposit('0x' + identityCommitment.toString(16), { value: depositAmtEth, gasLimit: 1500000 })
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
                BigInt(feeAmtWei.toString()),
                publicSignals,
            )

            validParamsForEth = params

            //console.log("validParamsForEth", validParamsForEth)

            recipientBalanceBefore = await provider.getBalance(recipientAddress)

            // make the API call to submit the proof
            const resp = await post(1, 'mixer_mix_eth', params)

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

            recipientBalanceAfter = await provider.getBalance(recipientAddress)
            expect(ethers.utils.formatEther(recipientBalanceAfter.sub(recipientBalanceBefore)))
                .toEqual('0.099')
        })
    }else{
        test('accepts a valid proof to mix tokens and credits the recipient', async () => {
            const relayerAddress = await getRelayerAddress(network)
            const expectedTokenAmtToReceive = mixAmt - feeAmt
            // mint tokens for the sender
            await tokenContract.mint(
                signer.address,
                (mixAmt * (10 ** tokenDecimals)).toString(),
                { gasLimit: 100000, }
            )
            await tokenContract.approve(
                mixerContract.address,
                (mixAmt * (10 ** tokenDecimals)).toString(),
                { gasLimit: 100000, }
            )

            // generate an identityCommitment
            const identity = genIdentity()
            const identityCommitment = genIdentityCommitment(identity)

            const tx = await mixerContract.depositERC20(
                identityCommitment.toString(),
                { gasLimit: 1500000, }
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
                feeAmt * 10 ** tokenDecimals,
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
                BigInt((feeAmt * 10 ** tokenDecimals).toString()),
                publicSignals,
            )

            validParamsForTokens = params

            recipientBalanceBefore = await tokenContract.balanceOf(recipientAddress)

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

            recipientBalanceAfter = await tokenContract.balanceOf(recipientAddress)
            const diff = recipientBalanceAfter.sub(recipientBalanceBefore).toString()
            expect(diff).toEqual((expectedTokenAmtToReceive * (10 ** tokenDecimals)).toString())
        })

    }



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
            lowFeeProof.fee = '0x0'

            const resp = await post(1, 'mixer_mix_tokens', lowFeeProof)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_INSUFFICIENT_TOKEN_FEE)
        })
    }else{
        test('rejects a proof where the ETH fee is too low', async () => {
            // deep copy and make the fee too low
            const lowFeeProof = JSON.parse(JSON.stringify(validParamsForEth))
            lowFeeProof.fee = '0x0001'

            const resp = await post(1, 'mixer_mix_eth', lowFeeProof)

            expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_INSUFFICIENT_ETH_FEE)
        })
    }




    afterAll(async () => {
        server.close()
    })
})
