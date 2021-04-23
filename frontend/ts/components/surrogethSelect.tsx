import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { ethers } from 'ethers'

import {
    getBroadcasterList
} from '../web3/surrogeth'

import {
    getBackendStatus
} from '../utils/backend'

import {
    network,
    enableBackend,
} from '../utils/configFrontend'


const customStyles = {
  control: () => ({
    // none of react-select's styles are passed to <Control />
    //width: "10em",
  }),
}

interface Relayer {
    feeCount : ethers.BigNumber,
    feeSum : ethers.BigNumber,
    fee : ethers.BigNumber,
    address : string,
    locator : string,
    locatorType : string,
}

const SurrogethSelect = (props) => {

    const [options, setOptions] = useState<Relayer[]>([])
    const [optionsBackend, setOptionsBackend] = useState<Relayer[]>([])
    let [selectedOption, setSelectedOption] = useState<Relayer | undefined>()
    const [isInit, setIsInit] = useState<number>(0)



    if (props.provider && !isInit){
        setIsInit(1)
        if (enableBackend){
            getBackendStatus(network).then((result) => {
                if (result){
                    let option = {
                            feeCount : ethers.BigNumber.from(0),
                            feeSum : ethers.BigNumber.from(0),
                            fee : ethers.BigNumber.from(props.feeAmtWei),
                            address : result.address,
                            locator : "/api",
                            locatorType : "backend",
                        }
                    setOptionsBackend([option])
                } else {
                    console.error("backend not found or not responding")
                }

            }).catch((err)=>{
                console.error("backend not found or not responding", err)
            })
        }
        getBroadcasterList(props.provider, network, props.tokenAddress).then((result) => {
            setIsInit(2)
            if (result && result.length > 0){
                let _options : Relayer[] = result
                setOptions(_options)
            } else {
                console.error("surrogeth not found or not responding")
            }
        }).catch(
            (error) => {
                setIsInit(2)
                console.error("surrogeth not found or not responding", error)
            })
    }

    let selectOptions : Relayer[] = []
    if (optionsBackend){
        selectOptions.push(...optionsBackend)
    }
    if (options){
        selectOptions.push(...options)
    }
    if (!selectedOption && selectOptions.length){
        for (let i = 0; i < selectOptions.length; i++){
            if (selectOptions[i].fee && selectOptions[i].fee.gt(0)){
                setSelectedOption(selectOptions[i])
                setTimeout(() => {props.setSurrogethInfo(selectOptions[i])}, 10)
                break;
            }
        }
    }

    const handleChange = _selectedOption => {
        selectOptions.forEach(element => {
            if (element.address == _selectedOption.target.value){
                setSelectedOption(_selectedOption)
                props.setSurrogethInfo(element)
            }
        })
    }

    return (
        <div>
        { isInit < 2 &&
            <div>
                Loading Surrogeth list...
            </div>
        }
        { isInit == 2 && !options &&
                <div>
                    No Surrogeth found
                </div>
        }
        { selectOptions.length > 0 &&
        <div className="control token-select">

            <div className="select is-primary">
                <select
                    id="surrogeth"
                    defaultValue={selectedOption? selectedOption.address : undefined}
                    onChange={handleChange}
                    >
                    {selectOptions.filter((option) => {
                        return 1 && option.fee
                    }).map((option) => {
                        let label = option.locatorType + ": " + option.locator
                        if (option.fee && option.fee.gt(0)){
                            label += " --- "
                            label += ethers.utils.formatUnits(
                                option.fee)
                            label += " "
                            label += props.tokenSym
                        }
                        let value : string = ""
                        if (option.address){
                            value = option.address
                        }
                        return <option
                            key={value}
                            value={value}
                            >{label}</option>
                        })}
                    </select>
            </div>
        </div>
        }
        </div>

    )
}

export default SurrogethSelect
