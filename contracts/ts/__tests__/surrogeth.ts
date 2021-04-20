import * as ethers from 'ethers'
import { SurrogethClient } from "surrogeth-client"

import {
    genDepositProof,
} from './utils'

const Mixer = require('@mixer-contracts/compiled/Mixer.json')
const ForwarderRegistryERC20 = require('@mixer-contracts/compiled/ForwarderRegistryERC20.json')

const surrogetSubmitTx = async (
    network,
    wallet,
    forwarderRegistryERC20Contract,
    tokenContractAddress,
    to,
    data,
    value : ethers.BigNumber,
    relayer,
) => {
    const protocol = "http"

    const client = new SurrogethClient(
        wallet,
        network, // "KOVAN" || "MAINNET"
        forwarderRegistryERC20Contract.address, // defaults to current deployment on specified network
        ForwarderRegistryERC20.abi,
        protocol, // "https" || "http"
        tokenContractAddress
    )

    const valueStr = value.toString()

    const tx = { to, data, value: valueStr }

    try {
        const result = await client.submitTx(tx, relayer)
        //console.log(result)
    } catch (error) {
        if (error.response){
            //console.log(error.response.data)
        } else {
            //console.log(error)
        }

        throw error
    }

}

const surrogetGetBroadcaster = async (
    network,
    wallet,
    forwarderRegistryERC20ContractAddress,
    tokenContractAddress,
    txGas
) => {
    const protocol = "http"

    const client = new SurrogethClient(
        wallet,
        network,
        forwarderRegistryERC20ContractAddress, // defaults to current deployment on specified network
        ForwarderRegistryERC20.abi,
        protocol, // "https" || "http"
        tokenContractAddress
    )

    let relayers = await client.getBroadcasters(
        //new Set([]), // don't ignore any addresses
        new Set(["ip"]) // only return relayers with an IP address
    )

    if (relayers.length > 0) {
        for (let i = 0; i < relayers.length; i++){
            relayers[i] = await client.getBroadcasterFee(relayers[i], txGas)
            if (relayers[i].fee) return relayers[i]
        }
    }

    return null;

}

const surrogethMix = async (
    network,
    wallet,
    relayer,
    forwarderRegistryERC20Contract,
    mixerContract,
    tokenContractAddress,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
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
    const mixCallData = iface.encodeFunctionData(functionName, [
	    depositProof.signal,
	    depositProof.a,
	    depositProof.b,
	    depositProof.c,
	    depositProof.input,
	    depositProof.recipientAddress,
	    depositProof.fee,
	    forwarderRegistryERC20Contract.address,
    ])

    const forwarderIface = new ethers.utils.Interface(ForwarderRegistryERC20.abi)
    let relayCallData
    if (tokenContractAddress){
        relayCallData = forwarderIface.encodeFunctionData("relayCallERC20",
            [
                mixerContract.address,
                mixCallData,
                tokenContractAddress,
            ],
        )
    }else{
        relayCallData = forwarderIface.encodeFunctionData("relayCall",
            [
                mixerContract.address,
                mixCallData
            ],
        )
    }

    return await surrogetSubmitTx(
        network,
        wallet,
        forwarderRegistryERC20Contract,
        tokenContractAddress,
        forwarderRegistryERC20Contract.address,
        relayCallData,
        ethers.BigNumber.from(0),
        relayer,
    )
}

export {
    surrogethMix,
    surrogetGetBroadcaster,
    surrogetSubmitTx,
}
