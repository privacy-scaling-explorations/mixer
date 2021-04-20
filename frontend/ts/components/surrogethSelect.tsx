import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { ethers } from 'ethers'

import {
    getBroadcasterList
} from '../web3/surrogeth'

import {
    network
} from '../utils/configFrontend'


const customStyles = {
  control: () => ({
    // none of react-select's styles are passed to <Control />
    //width: "10em",
  }),
}

export default (props) => {
    const defaultOption : {
        feeCount : ethers.BigNumber,
        feeSum : ethers.BigNumber,
        fee : ethers.BigNumber,
        address : string,
        locator : string,
        locatorType : string,
    } = {
            feeCount : ethers.BigNumber.from(0),
            feeSum : ethers.BigNumber.from(0),
            fee : ethers.BigNumber.from(props.feeAmtWei),
            address : "backend",
            locator : "/api",
            locatorType : "backend",
        }

    const [options, setOptions] = useState([defaultOption])
    let [selectedOption, setSelectedOption] = useState(defaultOption)
    const [isInit, setIsInit] = useState(false)

    const handleChange = _selectedOption => {
        options.forEach(element => {
            if (element.address == _selectedOption.target.value){
                setSelectedOption(_selectedOption)
                props.setSurrogethInfo(element)
            }
        })
    }

    if (props.provider && !isInit){
        setIsInit(true)
        props.setSurrogethInfo(defaultOption)
        getBroadcasterList(props.provider, network, props.tokenAddress).then((result) => {
            if (result){
                let _options : any[] = result

                if (_options && _options.length > 0){
                    _options.push(defaultOption)
                    setSelectedOption(defaultOption)
                } else {
                    _options = [defaultOption]
                }
                setOptions(_options)
            }


        }).catch(
            (error) => {
                console.log(error)
            })
    }

    return (
        <div className="control token-select">
            <div className="select is-primary">
                <select
                    id="surrogeth"
                    defaultValue={selectedOption.address}
                    onChange={handleChange}
                    >
                    {options.filter((option) => {
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

    )
}
