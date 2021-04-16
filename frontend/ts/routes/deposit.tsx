import React, { useState, Component, useContext, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Redirect } from 'react-router-dom'
import * as ethers from 'ethers'
import { Buffer } from 'buffer'
import { Erc20ApproveButton, TxButton, TxStatuses } from '../components/txButton'
import { TxHashMessage } from '../components/txHashMessage'
import { sleep } from 'mixer-utils'
// @ts-ignore
import cat from '../../img/cat.png'

import {
    initStorage,
    storeDeposit,
    updateDepositTxStatus,
    getNumUnwithdrawn,
} from '../storage'

import {
    depositEth,
    depositTokens,
    approveTokens
} from '../web3/deposit'
import {
    genIdentity,
    genIdentityCommitment,
} from 'libsemaphore'

import {
    isETH,
    feeAmt,
    tokenSym,
    blockExplorerTxPrefix,
    tokenDecimals,
    tokenAddress,
} from '../utils/configFrontend'

import {
    getBalance,
    getTokenBalance,
    getTokenAllowance,
} from '../utils/networkInfo'


import MixerDeposit from '../components/mixerDeposit'
import MixerSelect from '../components/mixerSelect'

const name = 'MicroMix'

export default (props) => {

    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [erc20ApproveTxStatus, setErc20ApproveTxStatus] = useState(TxStatuses.None)
    const [txHash, setTxHash] = useState('')
    const [recipientAddress, setRecipientAddress] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [mixInfo, setMixInfo] = useState<{mixAmt : ethers.BigNumber, address : string}>()
    const [balance, setBalance] = useState<ethers.BigNumber>()
    const [tokenBalance, setTokenBalance] = useState<ethers.BigNumber>()
    const [tokenAllowance, setTokenAllowance] = useState<ethers.BigNumber>()

    let mixAmt
    let mixAmtWei
    let feeAmtWei
    let mixerAddress
    if(mixInfo){
        feeAmtWei = ethers.utils.parseUnits(feeAmt.toString(), tokenDecimals)
        mixAmtWei = mixInfo.mixAmt
        mixAmt = ethers.utils.formatUnits(mixAmtWei, tokenDecimals)
        mixerAddress = mixInfo.address
    }


    let tokenAllowanceNeeded = ethers.BigNumber.from(-1)
    let enoughEth = false
    let enoughEthAndToken = false

    const updateBalance = (_balance) => {
        console.log("Balance : " + _balance)
        if (balance != _balance){
            setBalance(_balance)
        }
    }

    const updateTokenBalance = (_balance) => {
        console.log("Token balance : " + _balance)
        if (tokenBalance != _balance){
            setTokenBalance(_balance)
        }
    }

    const updateTokenAllowance = (_balance) => {
        console.log("Token allowance : " + _balance)
        if (tokenAllowance != _balance){
            setTokenAllowance(_balance)
        }
    }

    const updateAllBalance = () => {
        if (props.address && props.signer){
            if (!balance){
                getBalance(props.signer, props.address, updateBalance)
            }
            if (!isETH){
                if (!tokenBalance){
                    getTokenBalance(props.signer, props.address, updateTokenBalance)
                }
                if (mixerAddress && !tokenAllowance){
                    getTokenAllowance(props.signer, props.address, mixerAddress, updateTokenAllowance)
                }
            }
        }
    }

    useEffect(() => {
        initStorage()
        updateAllBalance()
        //const interval = setInterval(() => checkBalance(interval), 1000)
        //return () => clearInterval(interval)
        //connectWallet()
    })

    const validRecipientAddress= recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)
    const depositBtnDisabled = !validRecipientAddress

    // Check whether there already is a deposit and disallow the user
    // from making another one
    // Redirect the user to the withdraw page if so

    if (getNumUnwithdrawn() > 0) {
          return <Redirect to='/countdown' />
    }

    const topUpEthMsg =
        <div className="column is-8 is-offset-2">
            <p>
                Please top up your account with at least {mixAmt}
                {tokenSym} ({mixAmt} to deposit and {feeAmt.toString()} for fee). You can get KETH
                from a faucet <a target="_blank"
                href="https://faucet.kovan.network/">here</a> or <a
                target="_blank" href="https://gitter.im/kovan-testnet/faucet">here</a>.
            </p>
        </div>

    let topUpDaiMsg

    if (!isETH)
        topUpDaiMsg =
        <div className="column is-8 is-offset-2">
            <p>
                Please top up your account with at least {mixAmt} {tokenSym}&nbsp;
                and {feeAmt.toString()} for fee. You can convert KETH to DAI <a
                href="https://cdp.makerdao.com" target="_blank">here</a>, and you can get KETH
                from a faucet <a target="_blank" href="https://faucet.kovan.network/">here</a> or <a target="_blank" href="https://gitter.im/kovan-testnet/faucet">here</a>.
            </p>
        </div>

    const handleTokenApproveBtnClick = async () => {
        setErc20ApproveTxStatus(TxStatuses.Pending)

        approveTokens(props.signer, tokenAllowanceNeeded, mixerAddress)
            .then(async (tx) => {
                await tx.wait();
                setErc20ApproveTxStatus(TxStatuses.Mined)
                updateAllBalance()
            })
            .catch((err) => {console.log(err); setErc20ApproveTxStatus(TxStatuses.Err)})
    }

    const handleDepositBtnClick = () => {
        if (!validRecipientAddress) {
            return
        }

        setTxStatus(TxStatuses.Pending)

        //Wait for redraw of pending button
        setTimeout(processDeposit, 100)

    }

    const processDeposit = async() => {
        // generate an Identity and identity commitment
        const identity = genIdentity()
        const identityCommitment = '0x' + genIdentityCommitment(identity).toString(16)
        // Perform the deposit tx
        try {
            let tx
            if (isETH) {
                tx = await depositEth(
                    props.signer,
                    identityCommitment,
                    ethers.utils.parseEther(mixAmt),
                    mixerAddress,
                )
            } else {
                tx = await depositTokens(
                    props.signer,
                    identityCommitment,
                    mixerAddress,
                )
            }
            setTxHash(tx.hash)
            storeDeposit(identity, recipientAddress, tokenAddress, mixerAddress, mixAmt)
            const receipt = await tx.wait()
            updateDepositTxStatus(identity, tx.hash)
            setTxStatus(TxStatuses.Mined)
        } catch (err) {
            console.log(err)
            setTxStatus(TxStatuses.Err)
            if (
                err.code === ethers.errors.UNSUPPORTED_OPERATION &&
                err.reason === 'contract not deployed'
            ) {
                setErrorMsg(`The mixer contract was not deployed to the expected ` +
                    `address ${mixerAddress}`)
            } else {
                setErrorMsg('An error with the transaction occurred.')
            }
        }
    }

    const checkBalances = () => {
        if (mixAmtWei) {
            const minAmt = isETH ? mixAmtWei.add(feeAmtWei) : feeAmtWei
            enoughEth = balance ? balance.gte(minAmt) : false
            if (!isETH) {
                const enoughToken = tokenBalance ? tokenBalance.gte(mixAmtWei) : false
                enoughEthAndToken = enoughEth && enoughToken
            }
            tokenAllowanceNeeded = tokenAllowance ? mixAmtWei.sub(tokenAllowance) : mixAmtWei
            if (tokenAllowanceNeeded.lt(ethers.BigNumber.from(0))) {
                tokenAllowanceNeeded = ethers.BigNumber.from(0)
            }
        }
    }

    checkBalances()


    const tokenAllowanceBtn = (
        <div>
            <br />
            <Erc20ApproveButton
                onClick={handleTokenApproveBtnClick}
                txStatus={erc20ApproveTxStatus}
                isDisabled={false}
                label= {`To continue, approve ${ethers.utils.formatUnits(tokenAllowanceNeeded, tokenDecimals)} ${tokenSym}`}
            />
            <br />
        </div>
    )



    const showMixForm = ((!props.error) &&
        (
            (!isETH && tokenAllowanceNeeded.isZero() && enoughEthAndToken) ||
            (isETH && enoughEth)
        ))

    /*
    console.log("deposit redraw ",
        "ETH : ", networkInfo.balance,
        "TOKEN : ", networkInfo.tokenBalance,
        "Allowance : ", networkInfo.allowance
    )
    */
    //return (<div>{networkInfo.balance} ETH, {networkInfo.tokenBalance} TOKEN, Allowance {tokenAllowanceNeeded} TOKEN</div>)

    const signer = props.signer
    const address = props.address

    return (
        <div className='columns has-text-centered'>
            <div className='column is-12'>
                <div className='section first-section'>
                    <h2 className='subtitle'>
                        {name} makes your ETH or ERC20 tokens anonymous.
                        Learn more <a href="https://github.com/jrastit/mixer"
                        target="_blank">here</a>.
                    </h2>

                    <div className='sendTo column is-12'>
                        <span>Send</span>
                        <MixerSelect signer={signer} address={address} setMixInfo={setMixInfo}/>
                        <span>to</span>
                    </div>

                    { showMixForm &&
                        <div className='column is-8 is-offset-2'>
                            <input
                                spellCheck={false}
                                className="input eth_address"
                                type="text"
                                placeholder="0x........"
                                value={recipientAddress}
                                onChange={(e) => {
                                    setRecipientAddress(e.target.value)
                                }}
                            />

                            <br />

                        </div>
                    }

                    { props.error ?
                        <p>
                            {props.error}
                        </p>
                        :
                        <div className='column is-12'>
                            <div>
                                <p>
                                    {`The fee is ${feeAmt} ${tokenSym}.`}
                                </p>
                                <p>
                                    {`The recipient will receive ${mixAmtWei ? ethers.utils.formatUnits(mixAmtWei.sub(feeAmtWei), tokenDecimals) : 0} ${tokenSym} after midnight, UTC.`}
                                </p>
                            </div>

                            { isETH && !enoughEth && topUpEthMsg }
                            { !isETH && !enoughEthAndToken && topUpDaiMsg }

                            { !isETH && enoughEthAndToken && tokenAllowanceNeeded.gt(0) && tokenAllowanceBtn }
                        </div>
                    }

                </div>

                { showMixForm &&
                    <div className='column is-12'>
                        <TxButton
                            onClick={handleDepositBtnClick}
                            txStatus={txStatus}
                            isDisabled={depositBtnDisabled}
                            label={`Mix ${mixAmt} ${tokenSym}`}
                        />

                        { txHash.length > 0 &&
                            <div>
                                <br />
                                <TxHashMessage
                                    mixSuccessful={false}
                                    txHash={txHash}
                                    txStatus={TxStatuses.Pending} />
                            </div>
                        }

                        { txStatus === TxStatuses.Mined &&
                            <article className="message is-success">
                                <div className="message-body">
                                    Transaction mined.
                                </div>
                                <Redirect to='/countdown' />
                            </article>
                        }

                        { txStatus === TxStatuses.Err &&
                            <div>
                                <br />
                                <article className="message is-danger">
                                    <div className="message-body">
                                        {errorMsg}
                                    </div>
                                </article>
                            </div>
                        }
                    </div>
                }
                <div className='column is-4 is-offset-4 is-10-mobile is-offset-1-mobile'>
                    <img src={cat} />
                </div>
            </div>
        </div>
    )
}
