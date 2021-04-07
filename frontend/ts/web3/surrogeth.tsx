import * as ethers from 'ethers'
import { forwarderRegistryERC20Address } from '../utils/configFrontend'
import { SurrogethClient } from "surrogeth-client"
const ForwarderRegistryERC20 = require('../../compiled/ForwarderRegistryERC20.json')

import { getForwarderRegistryERC20Contract } from './mixer'

const getBroadcasterList = async (wallet, network, token, decimals) => {

    const protocol = "http"

    const client = new SurrogethClient(
        wallet,
        network,
        forwarderRegistryERC20Address, // defaults to current deployment on specified network
        ForwarderRegistryERC20.abi,
        protocol // "https" || "http"
    )




    if (token){

    }else{
        let relayers = await client.getBroadcasters(
            1,
            //new Set([]), // don't ignore any addresses
            new Set(["ip"]) // only return relayers with an IP address
        )
        //console.log("relayers", relayers)
        if (relayers.length > 0) {
            const forwarderRegistryERC20Contract = await getForwarderRegistryERC20Contract(wallet.provider)

            await Promise.all(relayers.map(async (relayer) => {
                const { feeSum, feeCount } = await forwarderRegistryERC20Contract.relayerToFeeAgg(
                  relayer.address
                )
                if(!feeCount.eq(0))
                    relayer.feeAvg = ethers.utils.formatUnits(feeSum.div(feeCount), decimals)
                relayer.feeCount = feeCount.toString()

            }))
            return relayers
        }

    }

    return null;
}




export { getBroadcasterList }
