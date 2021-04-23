import React, { useState, useEffect } from 'react'

import {
    endsAtMidnight,
    endsAfterSecs,
} from '../utils/configFrontend'

const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const TimerComponent = (props) => {

    let timeStr

    const calculateTimeLeft = () => {
        let expiryDate = new Date(props.timestamp)
        //console.log("expiryDate", expiryDate)

        //console.log("expiryDate", expiryDate, endsAtMidnight)
        // Whether the current time is greater than the expiry timestamp (i.e.
        // UTC midnight

        // Dev only
        if (!endsAtMidnight) {
            expiryDate.setSeconds(
                expiryDate.getSeconds() + endsAfterSecs
            )
        }else{
            expiryDate.setUTCHours(23, 59, 59, 999)
        }

        let expiryTimestamp =  expiryDate.getTime()

        timeStr = `${expiryDate.getDate()} ${months[expiryDate.getMonth()]} ` +
            `${expiryDate.getFullYear()}, ${expiryDate.toLocaleTimeString()}`

        let difference = expiryTimestamp - +new Date();
        if (difference > 0) {
            return {
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            }
        }
        return undefined

    }
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())

    useEffect(() => {
        const timer=setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        // Clear timeout if the component is unmounted
        return () => clearTimeout(timer);
    });

    if (timeLeft){
        return (
            <div className="columns has-text-centered">
                <div className='column is-12'>
                    <h2 className='subtitle'>
                        {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s left to {timeStr}<br/><br/>
                    </h2>
                </div>
            </div>)
    }else{
        setTimeout(() => {props.setWithdrawEnable(true)}, 100)
        return (
            <div className="columns has-text-centered">
                <div className='column is-12'>
                    <h2 className='subtitle'>
                        Withdraw ready.
                    </h2>
                </div>
            </div>)
    }
}

export default TimerComponent
