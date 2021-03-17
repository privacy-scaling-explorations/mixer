const getBackendStatus = async (networkName) => {
    let result

    const method = 'status'

    const params = {networkName: networkName}

    const request = {
        jsonrpc: '2.0',
        id: (new Date()).getTime(),
        method,
        params,
    }

    //console.log("request:", request.toString(), request)

    const response = await fetch(
        '/api',
        {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json',
            }
        },
    )

    try{
        const responseJson = await response.json()
        if (responseJson.result) {
            //console.log("Serveur Relayer Address", responseJson.result.address)
            result = responseJson.result
        } else if (responseJson.error && responseJson.error.code && responseJson.error.message){
            console.log(responseJson.error)
        } else {
            console.log(response)
        }
    }catch(err){
        console.log(err)
        console.log("Response:", response)
    }

    return result
}

export {
    getBackendStatus
}
