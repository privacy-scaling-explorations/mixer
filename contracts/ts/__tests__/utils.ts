import * as ethers from 'ethers'
import {
    SnarkProvingKey,
    SnarkVerifyingKey,
    genCircuit,
    parseVerifyingKeyJson,
} from 'libsemaphore'
import { SurrogethClient } from "surrogeth-client"
const fs = require('fs');
const path = require('path');

const Mixer = require('@mixer-contracts/compiled/Mixer.json')

const mix = async (
    forwarderContract,
    mixerContract,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    relayerAddress,
    functionName,
) => {
    const depositProof = genDepositProof(
        signal,
        proof,
        publicSignals,
        recipientAddress,
        feeAmt,
    )
    const iface = new ethers.utils.Interface(Mixer.abi)
    const callData = iface.encodeFunctionData(functionName, [
	depositProof.signal,
	depositProof.a,
	depositProof.b,
	depositProof.c,
	depositProof.input,
	depositProof.recipientAddress,
	depositProof.fee,
	relayerAddress])

    return forwarderContract.relayCall(
        mixerContract.address,
        callData,
        { gasLimit: 1000000 }
    )

    //return await mixerContract.mix(
        //depositProof,
        //relayerAddress,
        //{ gasLimit: 1000000 }
    //)
}

const buildRawTx = async (
    to,
    wallet,
    value,
    chainId,
) => {
    const gasLimit = ethers.utils.hexlify(21000)
    const gasPrice = await wallet.provider.getGasPrice()
    const txCount = await wallet.provider.getTransactionCount(wallet.address)
    // build the transaction
    const txRequest = {
        to: to,
        from: wallet.address,
        nonce: ethers.utils.hexlify(txCount),
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        data: null,
        value: value,
        //Just for testing
        chainId: chainId,
    }

    return await wallet.signTransaction(txRequest)
}

const surrogetSubmitTx = async (
    network,
    wallet,
    registryContractAddress,
    to,
    data,
    value : ethers.BigNumber,
    relayer,
) => {
    const protocol = "http"

    const Registry = require('@mixer-contracts/compiled/Registry.json')

    const client = new SurrogethClient(
        wallet,
        network, // "KOVAN" || "MAINNET"
        registryContractAddress, // defaults to current deployment on specified network
        Registry.abi,
        protocol // "https" || "http"
    )

    const valueStr = value.toString()

    const tx = { to, data, value: valueStr }

    try {
        const result = await client.submitTx(tx, relayer)
        console.log(result)
    } catch (error) {
        console.log(error.response.data)
        throw error
    }

}

const surrogetGetBroadcaster = async (
    wallet,
    registryContractAddress,
) => {
    const network = "LOCAL"
    const protocol = "http"

    const Registry = require('@mixer-contracts/compiled/Registry.json')


    const client = new SurrogethClient(
        wallet,
        network, // "KOVAN" || "MAINNET"
        registryContractAddress, // defaults to current deployment on specified network
        Registry.abi,
        protocol // "https" || "http"
    )

    //console.log("client", client)

    //console.log(JSON.stringify(Registry.abi, null, 2))

    let relayers = await client.getBroadcasters(
        1,
        //new Set([]), // don't ignore any addresses
        new Set(["ip"]) // only return relayers with an IP address
    )

    console.log("relayers", relayers)

    if (!relayers.length){

        console.log("Set default relayer locator")

        const tx = await client.setIPRelayerLocator("127.0.0.1:8123")

        await tx.wait()

        relayers = await client.getBroadcasters(
            1,
            //new Set([]), // don't ignore any addresses
            new Set(["ip"]) // only return relayers with an IP address
        )
    }

    if (relayers.length > 0) {
        const fee = await client.getAvgFee(relayers[0])

        console.log("fee", fee)

        // ... construct transaction using fee -> tx: {to, data, value}. If this tx is to be used in the burn
        // registry, it *must* be sent to the deployed RelayerForwarder contract

        //const txHash = await client.submitTx(tx, relayers[0]);
        return relayers[0]
    }

    return null;

}

const surrogethMix = async (
    network,
    wallet,
    registryContractAddress,
    relayer,
    forwarderContract,
    mixerContract,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    relayerAddress,
    functionName,
) => {

    const Forwarder = require('@mixer-contracts/compiled/Forwarder.json')

    const depositProof = genDepositProof(
        signal,
        proof,
        publicSignals,
        recipientAddress,
        feeAmt,
    )

    const iface = new ethers.utils.Interface(Mixer.abi)
    const mixCallData = iface.encodeFunctionData(functionName, [
	depositProof.signal,
	depositProof.a,
	depositProof.b,
	depositProof.c,
	depositProof.input,
	depositProof.recipientAddress,
	depositProof.fee,
	relayerAddress])

    const forwarderIface = new ethers.utils.Interface(Forwarder.abi)
    const relayCallData = forwarderIface.encodeFunctionData("relayCall",
        [
            mixerContract.address,
            mixCallData
        ],
    )

    await surrogetGetBroadcaster(
        wallet,
        registryContractAddress,
    )

    return await surrogetSubmitTx(
        network,
        wallet,
        registryContractAddress,
        forwarderContract.address,
        relayCallData,
        ethers.BigNumber.from(0),
        relayer,
    )
}


const genDepositProof = (
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
) => {
    return {
        signal,
        a: [ ethers.BigNumber.from(proof.pi_a[0]), ethers.BigNumber.from(proof.pi_a[1]) ],
        b: [
            [ ethers.BigNumber.from(proof.pi_b[0][1]), ethers.BigNumber.from(proof.pi_b[0][0]) ],
            [ ethers.BigNumber.from(proof.pi_b[1][1]), ethers.BigNumber.from(proof.pi_b[1][0]) ],
        ],
        c: [ ethers.BigNumber.from(proof.pi_c[0]), ethers.BigNumber.from(proof.pi_c[1]) ],
        input: [
            ethers.BigNumber.from(publicSignals[0]),
            ethers.BigNumber.from(publicSignals[1]),
            ethers.BigNumber.from(publicSignals[2]),
            ethers.BigNumber.from(publicSignals[3]),
        ],
        recipientAddress,
        fee: feeAmt,
    }
}

const areEqualAddresses = (a: string, b: string) => {
    return BigInt(a) === BigInt(b)
}

const getSnarks = () => {
    const verifyingKey = parseVerifyingKeyJson(fs.readFileSync(
        path.join(
            __dirname,
            '../../../semaphore/semaphorejs/build/verification_key.json',
        )
    ))

    const provingKey: SnarkProvingKey = fs.readFileSync(
        path.join(__dirname, '../../../semaphore/semaphorejs/build/proving_key.bin'),
    )
    const circuitPath = '../../../semaphore/semaphorejs/build/circuit.json'
    const cirDef = JSON.parse(
        fs.readFileSync(path.join(__dirname, circuitPath)).toString()
    )

    const circuit = genCircuit(cirDef)

    return {
        verifyingKey,
        provingKey,
        circuit,
    }
}

const checkErrorReason = (error, errorMsg) => {
    if (error.error && error.error.data){
        if (error.error.data[error.transactionHash]){
            expect(error.error.data[error.transactionHash].reason).toMatch(errorMsg)
            return
        }
    } if (error.reason){
        //expect(error.reason).toMatch('transaction failed')
        //expect(error.reason).toMatch(errorMsg)
        if (error.reason == "cannot estimate gas; transaction may fail or may require manual gas limit"){
                return
        }
        if (error.reason == "transaction failed"){
                return
        }
        expect(error.reason).toMatch('processing response error')
        return
    } else {
        expect(error.error.stack).toMatch(errorMsg)
        return
    }
    console.log(error)
    expect(true).toBeFalsy()
}

const performeDeposit = async (isETH, identityCommitment, mixAmtToken, mixerContract, tokenContract) => {
    let tx
    if (isETH){
        tx = await mixerContract.deposit(
            '0x' + identityCommitment.toString(16),
            {value: '0x' + BigInt(mixAmtToken).toString(16),
             gasLimit: 1500000 })
    } else {
        const txApprove = await tokenContract.approve(
            mixerContract.address,
            mixAmtToken,
        )
        const receipt = await txApprove.wait()

        tx = await mixerContract.depositERC20(
            '0x' + identityCommitment.toString(16),
            { gasLimit: 1500000 })
    }

    const receipt = await tx.wait()

    // check that the leaf was added using the receipt
    expect(receipt.events).toBeTruthy()
    expect(receipt.events[receipt.events.length - 1].event).toMatch('Deposited')

    return receipt
}

const addressInfo = async (name, addr, isETH, wallet, decimals, tokenContract) => {
    let balance
    if (isETH){
        balance = await wallet.provider.getBalance(addr)
    } else {
        balance = await tokenContract.balanceOf(addr)
    }
    balance = parseFloat(ethers.utils.formatUnits(balance, decimals))
    console.log("Address : ",
        name,
        " : ",
        addr,
        " balance : ",
        balance.toString())
}

export {
    performeDeposit,
    checkErrorReason,
    genDepositProof,
    areEqualAddresses,
    mix,
    surrogethMix,
    surrogetGetBroadcaster,
    getSnarks,
    addressInfo,
    buildRawTx,
    surrogetSubmitTx,
}
