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
        protocol // "https" || "http"
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
) => {
    const protocol = "http"

    const client = new SurrogethClient(
        wallet,
        network, // "KOVAN" || "MAINNET"
        forwarderRegistryERC20ContractAddress, // defaults to current deployment on specified network
        ForwarderRegistryERC20.abi,
        protocol // "https" || "http"
    )

    //console.log("client", client)

    //console.log(JSON.stringify(ForwarderRegistryERC20.abi, null, 2))

    let relayers = await client.getBroadcasters(
        1,
        //new Set([]), // don't ignore any addresses
        new Set(["ip"]) // only return relayers with an IP address
    )

    //console.log("relayers", relayers)

    if (!relayers.length){

        console.log("Set default relayer locator")

        const tx = await client.setIPRelayerLocator("127.0.0.1:8123")

        //await tx.wait()

        relayers = await client.getBroadcasters(
            1,
            //new Set([]), // don't ignore any addresses
            new Set(["ip"]) // only return relayers with an IP address
        )
    }

    if (relayers.length > 0) {
        const fee = await client.getAvgFee(relayers[0])

        //console.log("fee", fee)

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
    relayer,
    forwarderRegistryERC20Contract,
    mixerContract,
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
    const relayCallData = forwarderIface.encodeFunctionData("relayCall",
        [
            mixerContract.address,
            mixCallData
        ],
    )

    await surrogetGetBroadcaster(
        network,
        wallet,
        forwarderRegistryERC20Contract.address,
    )

    return await surrogetSubmitTx(
        network,
        wallet,
        forwarderRegistryERC20Contract,
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
