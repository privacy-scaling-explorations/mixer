import React, { useState, useEffect } from 'react'
import * as ethers from 'ethers'

import {
    getTokenContract
} from '../web3/contract'

export default (props) => {

    const [txHash, setTxHash] = useState<{
        txHash:String,
        balance:ethers.BigNumber,
        balanceBefore:ethers.BigNumber,
    } | undefined>()

    const calculateBalance = async (_txHash:{
        txHash:String,
        balance:ethers.BigNumber,
        balanceBefore:ethers.BigNumber,
    }, timer) => {
        let balanceAfter
        if ( props.tokenAddress){
            const tokenContract = await getTokenContract(props.provider, props.tokenAddress)
            balanceAfter = await tokenContract.balanceOf(props.recipientAddress)
        } else {
            balanceAfter = await props.provider.getBalance(props.recipientAddress)
        }
        const balance = balanceAfter.sub(_txHash.balanceBefore)
        if (!balance.isZero() && !_txHash.balance.eq(balance)){
            setTxHash({
                txHash:_txHash.txHash,
                balance,
                balanceBefore:_txHash.balanceBefore,
            })
        }else{
            timer.timer=setTimeout(calculateBalance
            , 1000, _txHash, setTxHash, timer)
        }


    }

    useEffect(() => {
        let timer : {timer: any | undefined} = {timer:null}
        if ((!txHash || txHash.balance.isZero()) && props.txHash){
            if (!props.txHash.balance.isZero()){
                setTxHash(props.txHash)
            }else{
                timer.timer=setTimeout(calculateBalance
                , 1000, props.txHash, timer)
            }
        }

        // Clear timeout if the component is unmounted
        return () => {if (timer.timer) clearTimeout(timer.timer)}
    })

    return (
        <div className="message-body">
            { txHash && !txHash.balance.isZero() &&
                <span>recipient balance incread by&nbsp;
            {ethers.utils.formatUnits(
                txHash.balance, props.tokenDecimals)}&nbsp;
                {props.tokenSym}</span>
            }
            {
                txHash && txHash.balance.isZero() &&
                <span>Checking balance ...</span>
            }
        </div>
    )



}
