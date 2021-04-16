import { ethers } from 'ethers'

import {
    chainId,
    supportedNetworkName,
    isETH,
} from '../utils/configFrontend'

import {
    getTokenContract,
} from '../web3/contract'

declare global {
    interface Window { ethereum: any; }
}

let provider
let signer

const addHooks = () => {
    window.ethereum.on('chainChanged', (_chainId) => window.location.reload());
    window.ethereum.on('accountsChanged', (accounts: Array<string>) => {console.log(accounts);window.location.reload()});
}

const getSigner = (setSigner, setError) => {
    const provider = new ethers.providers.Web3Provider(
        window.ethereum,
        {
            name : supportedNetworkName,
            chainId : chainId
        })
    provider.getNetwork().then(
        (network) => {
            if (network.chainId != chainId) {
                setError("Wrong network in Metamask, please use " +
                    supportedNetworkName +
                    "(" +
                    chainId +
                    ")"
                )
            } else {
                setSigner(provider.getSigner())
            }
        }).catch((error) => {
            console.error("error in get network ", error)
            setError("Wrong network in Metamask, please use " +
                supportedNetworkName +
                " (" +
                chainId +
                ")"
            )
        })
}

const getAddress = (signer, setAddress) => {
    signer.getAddress().then(
        (address) => {
            setAddress(address, signer)
        }).catch(
            err => {
                console.log("error in get address ", err)
                setAddress("error")
            }
        )
}

const getBalance = async (signer, address, setBalance) => {
    signer.provider.getBalance(address).then(
        (balance) => {
        //console.log("balance", balance)
            setBalance(balance)
        }).catch(err => console.log("error in get balance ", err))
}

const getTokenBalance = async (signer, address, setTokenBalance) => {
    getTokenContract(signer.provider).then((tokenContract) => {
        tokenContract.balanceOf(address).then((balance) => {
            setTokenBalance(balance)
        }).catch(err => console.log("error in get token balance ", err))
    }).catch(err => console.log("error in get token contract ", err))
}

const getTokenAllowance = async (signer, address, mixerAddress, setTokenAllowance) => {
    getTokenContract(signer.provider).then((tokenContract) => {
        tokenContract.allowance(address, mixerAddress).then((allowance) => {
            setTokenAllowance(allowance)
        }).catch(err => console.log("error in get token allowance ", err))
    }).catch(err => console.log("error in get token contract ", err))
}

export {
    addHooks,
    getSigner,
    getBalance,
    getAddress,
    getTokenBalance,
    getTokenAllowance,

}
