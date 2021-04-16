import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route } from 'react-router-dom'
import ethers from 'ethers'

import Nav from './nav'
import AboutRoute from './routes/about'
import DepositRoute from './routes/deposit'
import CountdownRoute from './routes/countdown'
import QuickWithdrawRoute from './routes/quickWithdraw'
import ContractInfoRoute from './routes/contractInfo'
import {ErrorBoundary} from 'react-error-boundary'
import '../less/index.less'

import {
    initStorage,
} from './storage'

import {
    getSigner,
    getAddress,
    addHooks,
} from './utils/networkInfo'

function ErrorFallback({error, resetErrorBoundary}) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}

const App = () => {

    initStorage()

    const [address, setAddress] = useState<{address:string, signer:ethers.Wallet | undefined}>({address:"Loading...", signer:undefined})
    const [error, setError] = useState()

    const updateAddress = (_address, _signer) => {
        console.log("address", _address)
        if (address.address != _address){
            setAddress({address: _address, signer: _signer})
        }
    }

    const updateSigner = (_signer) => {
        getAddress(_signer, updateAddress)
    }

    const updateError = (_error) => {
        console.log("error : ", _error)
        setError(_error)
    }

    useEffect(() => {
        if (!address.signer){
            getSigner(updateSigner, updateError)
            addHooks()
        }
    })

    const signer = address.signer
    const provider = signer ? signer.provider : undefined

    return (
            <div className='section'>
            <ErrorBoundary
                FallbackComponent={ErrorFallback}
                onReset={() => {
                    // reset the state of your app so the error doesn't happen again
                }}
                >
                <Nav address={address.address} error={error}/>
            </ErrorBoundary>

                <div className='section'>
                    <div className='container'>
                    <ErrorBoundary
                        FallbackComponent={ErrorFallback}
                        onReset={() => {
                            // reset the state of your app so the error doesn't happen again
                        }}
                        >
                        <Router>
                            <Route path='/' exact render={(props) => (<DepositRoute {...props} signer={address.signer} address={address.address} error={error}/>)} />
                            <Route path='/about' exact component={AboutRoute} />
                            <Route path='/countdown' exact render={(props) => (<CountdownRoute {...props} error={error} provider={provider}/>) } />
                            <Route path='/quick_withdraw' exact render={(props) => (<QuickWithdrawRoute {...props} error={error} signer={signer} address={address.address}/>)} />
                            <Route path='/contract_info' exact render={(props) => (<ContractInfoRoute {...props} provider={provider}/>)} />
                        </Router>
                    </ErrorBoundary>
                    </div>
                </div>
            </div>
    )
}

const root = document.getElementById('root')

ReactDOM.render(<App />, root)
