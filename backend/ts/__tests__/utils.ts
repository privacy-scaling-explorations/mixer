import axios from 'axios'
import * as JsonRpc from '../jsonRpc'
import { config } from 'mixer-config'

import {
    backendPort,
    backendHost,
} from '../utils/configBackend'

const PORT = backendPort
const HOST = backendHost + ':' + PORT.toString()

const OPTS = {
    headers: {
        'Content-Type': 'application/json',
    }
}

const post = (id: JsonRpc.Id, method: string, params: any) => {
    return axios.post(
        HOST,
        {
            jsonrpc: '2.0',
            id,
            method,
            params,
        },
        OPTS,
    )
}

export {
    post,
}
