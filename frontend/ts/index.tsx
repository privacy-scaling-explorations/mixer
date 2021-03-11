import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route } from 'react-router-dom'

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
    return (
            <div className='section'>
            <ErrorBoundary
                FallbackComponent={ErrorFallback}
                onReset={() => {
                    // reset the state of your app so the error doesn't happen again
                }}
                >
                <Nav />
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
                            <Route path='/' exact component={DepositRoute} />
                            <Route path='/about' exact component={AboutRoute} />
                            <Route path='/countdown' exact component={CountdownRoute} />
                            <Route path='/quick_withdraw' exact component={QuickWithdrawRoute} />
                            <Route path='/contract_info' exact component={ContractInfoRoute} />
                        </Router>
                    </ErrorBoundary>
                    </div>
                </div>
            </div>
    )
}

const root = document.getElementById('root')

ReactDOM.render(<App />, root)
