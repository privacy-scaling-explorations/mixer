import React, { useState } from 'react'
import { ethers } from 'ethers'

import {
    getMixerContract
} from '../web3/contract'

import ProgressBar from '../components/progressBar'

const MixerDeposit = (props) => {

    const provider = props.provider
    const mixerAddress = props.mixerAddress
    const transactionHash = props.transactionHash

    const [eventList, setEventList] = useState<ethers.Event[]>([])

    const updateDeposited = (event_) => {
        console.log("Update event ", event_)
        const lastEvent = eventList && eventList.length > 0 ?
            eventList[eventList.length - 1] : undefined

        //add event if it is newer than last event
        if (!lastEvent ||
            lastEvent.blockNumber < event_.blockNumber ||
            (lastEvent.blockNumber == event_.blockNumber &&
                lastEvent.transactionIndex < event_.transactionIndex)
        ){
            const eventList_ = [...eventList]
            eventList_.push(event_)
            setEventList(eventList_)
        }
    }

    const loadEvent = () => {
        getMixerContract(provider, mixerAddress).then((mixerContract) =>{
            mixerContract.on(mixerContract.filters.Deposited(), loadEvent)
            //filter by timestamp not to overload ? no easy way
            provider.getTransaction(transactionHash).then((tx) => {
                mixerContract.queryFilter(mixerContract.filters.Deposited(), tx.blockNumber).then((eventList_)=>{
                    if (eventList_){
                        if (eventList.length < eventList_.length){
                            if (transactionHash){
                                let found = false
                                const eventListNew = eventList_.filter((event)=>{
                                    if (found) {
                                        return true
                                    } else if (event.transactionHash == transactionHash){
                                        found = true
                                    }
                                    return false
                                })
                                if (eventList.length < eventListNew.length){
                                    setEventList(eventListNew)
                                }
                            }
                        }
                    }
                })
            })
        })
    }

    if (provider && mixerAddress && eventList.length == 0){
        loadEvent()
    }

    let completed = eventList.length  * 10
    if (completed > 100){
        completed = 100
    }

    let color
    let level
    if (eventList.length > 9){
        color = "#2ECC40" //Green
        level = "great"
    } else if (eventList.length > 7){
        color = "#01FF70" //Lime
        level = "good"
    } else if (eventList.length > 4){
        color = "#FFDC00" //Yellow
        level = "average"
    } else if (eventList.length > 2){
        color = "#FF851B" //Orange
        level = "bad"
    } else {
        color = "#FF4136" //Red
        level = "null"
    }

    return (
        <div>
            <div >
                They have been {eventList.length} deposit since your deposit<br/>
                <span style={{color: color,fontWeight: 'bold' as 'bold'}}>
                Anonimity level is {level}</span><br/>
                Waiting longer for other deposit will increase your anonimity
            </div>
            <div>
                <ProgressBar
                    color={color}
                    completed={completed}/>
            </div>

        </div>
    )
}

export default MixerDeposit
