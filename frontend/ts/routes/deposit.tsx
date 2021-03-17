import React, { useState, Component, useContext, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Redirect } from 'react-router-dom'
import * as ethers from 'ethers'
import { Buffer } from 'buffer'
import { ConnectionContext } from '../utils/connectionContext'
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

import { depositEth, depositTokens, getTokenAllowance, approveTokens } from '../web3/deposit'
import {
    genIdentity,
    genIdentityCommitment,
} from 'libsemaphore'

import {
    isETH,
    chainId,
    mixAmt,
    operatorFee,
    tokenSym,
    blockExplorerTxPrefix,
    tokenDecimals,
    supportedNetworkName,
    configEnv,
    mixerAddress,
} from '../utils/configFrontend'

const name = 'MicroMix'

const topUpEthMsg =
    <div className="column is-8 is-offset-2">
        <p>
            Please top up your account with at least {mixAmt.toString()}
            {tokenSym} ({mixAmt.toString()} to deposit and 0.1 for fee). You can get KETH
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
            Please top up your account with at least {mixAmt.toString()} {tokenSym}
            and {operatorFee.toString()} for fee. You can convert KETH to DAI <a
            href="https://cdp.makerdao.com" target="_blank">here</a>, and you can get KETH
            from a faucet <a target="_blank" href="https://faucet.kovan.network/">here</a> or <a target="_blank" href="https://gitter.im/kovan-testnet/faucet">here</a>.
        </p>
    </div>

export default () => {

    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [erc20ApproveTxStatus, setErc20ApproveTxStatus] = useState(TxStatuses.None)
    const [txHash, setTxHash] = useState('')
    const [recipientAddress, setRecipientAddress] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [tokenType, setTokenType] = useState(tokenSym)

    let tokenAllowanceNeeded = -1
    let enoughEth = false
    let enoughEthAndToken = false


    const context = useContext(ConnectionContext)
    const [networkInfo, setnetworkInfo] = useState(
        {
            chainId : context.networkChainId,
            address : context.address,
            balance : context.balance,
            tokenBalance : context.tokenBalance,
            allowance : context.allowance,
        })
    const connectWallet = () => {
        //console.log("connectWallet deposit", context.networkChainId, networkInfo.chainId, context.address, networkInfo.address)
        const networkInfoNew = {
            chainId : context.networkChainId,
            address : context.address,
            balance : context.balance,
            tokenBalance : context.tokenBalance,
            allowance : context.allowance,
        }
        if (JSON.stringify(networkInfo) !== JSON.stringify(networkInfoNew) )
            setnetworkInfo(networkInfoNew)
    }

    useEffect(() => {
        initStorage()
        const interval = setInterval(() => connectWallet(), 1000)
        return () => clearInterval(interval)
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



    const handleTokenApproveBtnClick = async () => {
        setErc20ApproveTxStatus(TxStatuses.Pending)

        approveTokens(context.provider, tokenAllowanceNeeded * (10 ** tokenDecimals))
            .then(async (tx) => {await tx.wait(); setErc20ApproveTxStatus(TxStatuses.Mined)})
            .catch((err) => {console.log(err); setErc20ApproveTxStatus(TxStatuses.Err)})
    }

    const handleDepositBtnClick = async () => {
        if (!validRecipientAddress) {
            return
        }

        initStorage()

        // generate an Identity and identity commitment
        const identity = genIdentity()
        const identityCommitment = '0x' + genIdentityCommitment(identity).toString(16)

        // Perform the deposit tx
        try {
            setTxStatus(TxStatuses.Pending)

            let tx
            if (isETH) {
                tx = await depositEth(
                    context.provider,
                    identityCommitment,
                    ethers.utils.parseEther(mixAmt.toString()),
                )
            } else {
                tx = await depositTokens(
                    context.provider,
                    identityCommitment,
                )
            }

            setTxHash(tx.hash)

            storeDeposit(identity, recipientAddress, tokenType)

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
        if (mixAmt && networkInfo.address ) {
            const minAmt = isETH ? mixAmt + operatorFee : operatorFee
            if (networkInfo.balance) {
                enoughEth = networkInfo.balance >= minAmt
            }
            if (!isETH) {
                const enoughToken = networkInfo.tokenBalance >= mixAmt
                enoughEthAndToken = enoughEth && enoughToken
            }
            tokenAllowanceNeeded = mixAmt - networkInfo.allowance
            if (tokenAllowanceNeeded < 0) {
                tokenAllowanceNeeded = 0
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
                label= {`To continue, approve ${tokenAllowanceNeeded} ${tokenType}`}
            />
            <br />
        </div>
    )



    const showMixForm = ((networkInfo.chainId == chainId) &&
        (
            (!isETH && tokenAllowanceNeeded === 0 && enoughEthAndToken) ||
            (isETH && enoughEth)
        ))

    const handleTokenTypeSelect = (e) => {
        const t = e.target.value
        setTokenType(t)
    }

    /*
    console.log("deposit redraw ",
        "ETH : ", networkInfo.balance,
        "TOKEN : ", networkInfo.tokenBalance,
        "Allowance : ", networkInfo.allowance
    )
    */
    //return (<div>{networkInfo.balance} ETH, {networkInfo.tokenBalance} TOKEN, Allowance {tokenAllowanceNeeded} TOKEN</div>)

    return (
        <div className='columns has-text-centered'>
            <div className='column is-12'>
                <div className='section first-section'>
                    <h2 className='subtitle'>
                        {name} makes your ETH or DAI anonymous.
                        Learn more <a href="https://github.com/weijiekoh/mixer"
                        target="_blank">here</a>.
                    </h2>

                    <div className='sendTo column is-12'>
                        <span>Send</span>
                        <div className="control token-select">
                            <div className="select is-primary">
                                <select
                                    value={tokenType}
                                    id="token"
                                    onChange={handleTokenTypeSelect}
                                >
                                    <option value="{tokenSym}">{mixAmt.toString()} {tokenSym}</option>
                                </select>
                            </div>
                        </div>
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

                    { (context.networkChainId && context.networkChainId !== chainId) === true ?
                        <p>
                            Please connect to
                            the {supportedNetworkName} Ethereum
                            network.
                        </p>
                        :
                        <div className='column is-12'>
                            <div>
                                <p>
                                    {`The fee is ${operatorFee} ${tokenSym}.`}
                                </p>
                                <p>
                                    {`The recipient will receive ${mixAmt - operatorFee} ${tokenSym} after midnight, UTC.`}
                                </p>
                            </div>

                            { isETH && !enoughEth && topUpEthMsg }
                            { !isETH && !enoughEthAndToken && topUpDaiMsg }

                            { !isETH && enoughEthAndToken && tokenAllowanceNeeded > 0 && tokenAllowanceBtn }
                        </div>
                    }

                </div>

                { showMixForm &&
                    <div className='column is-12'>
                        <TxButton
                            onClick={handleDepositBtnClick}
                            txStatus={txStatus}
                            isDisabled={depositBtnDisabled}
                            label={`Mix ${mixAmt} ${tokenType}`}
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
