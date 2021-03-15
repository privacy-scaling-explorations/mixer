require('module-alias/register')

import Ajv, { ValidateFunction } from 'ajv'

const genValidator = (
    name: string,
) => {
    const ajv = new Ajv({strict:false})
    const schema = require(`@mixer-backend/schemas/${name}.json`)
    try{
        const validate: ValidateFunction = ajv.compile(schema)
        return validate
    }catch(err){
        console.log(schema)
        console.log(err)
        throw err
    }

}

export { genValidator }
