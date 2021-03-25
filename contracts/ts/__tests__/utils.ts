import * as ethers from 'ethers'
import {
    SnarkProvingKey,
    SnarkVerifyingKey,
    genCircuit,
    parseVerifyingKeyJson,
} from 'libsemaphore'

const fs = require('fs');
const path = require('path');

const Mixer = require('@mixer-contracts/compiled/Mixer.json')

const mix = async (
    forwarderRegistryERC20Contract,
    mixerContract,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    relayerAddresse,
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
	    relayerAddresse,
    ])

    return forwarderRegistryERC20Contract.relayCall(
        mixerContract.address,
        callData,
        //{ gasLimit: 1000000 }
    )

    //return await mixerContract.mix(
        //depositProof,
        //relayerAddress,
        //{ gasLimit: 1000000 }
    //)
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
            {
                value: '0x' + BigInt(mixAmtToken).toString(16),
                //gasLimit: 1500000
            }
         )
    } else {
        const txApprove = await tokenContract.approve(
            mixerContract.address,
            mixAmtToken,
        )
        const receipt = await txApprove.wait()

        tx = await mixerContract.depositERC20(
            '0x' + identityCommitment.toString(16),
            //{ gasLimit: 1500000 }
        )
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
    getSnarks,
    addressInfo,
}
