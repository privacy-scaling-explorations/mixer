import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { ethers } from 'ethers'

import {
    tokenAddress,
    tokenDecimals,
    tokenSym,
} from '../utils/configFrontend'

import {
    getMixerList
} from '../utils/mixerRegistry'


const customStyles = {
  control: () => ({
    // none of react-select's styles are passed to <Control />
    //width: "10em",
  }),
}

export default (props) => {
    const defaultOption : {mixAmt : ethers.BigNumber, address : string} = {mixAmt : ethers.BigNumber.from(0), address : ""}
    const [options, setOptions] = useState([defaultOption])
    let [selectedOption, setSelectedOption] = useState(defaultOption)
    const [isInit, setIsInit] = useState(false)

    const handleChange = _selectedOption => {
        options.forEach(element => {
            if (element.address == _selectedOption.target.value){
                props.setMixInfo(element)
            }
        });

    }

    if (props.signer && !isInit){
        setIsInit(true)
        getMixerList(props.signer, tokenAddress).then((result) => {
            const options_ = result
            setOptions(options_)
            if (options_.length > 0){
                setSelectedOption(options_[0])
                if (options_[0].mixAmt){
                    props.setMixInfo(options_[0])
                }
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
                    id="token"
                    defaultValue={selectedOption.address}
                    onChange={handleChange}
                    >
                    {options.map((option) => {
                        const label = ethers.utils.formatUnits(option.mixAmt, tokenDecimals)
                        let value : string = ""
                        if (option.address){
                            value = option.address
                        }
                        return <option
                            key={value}
                            value={value}
                            >{label}&nbsp;{tokenSym}</option>
                        })}

                    </select>
            </div>
        </div>

    )
}
