require('module-alias/register')

import Ajv, { ValidateFunction } from 'ajv'

const genValidator = (
    name: string,
) => {
    const ajv = new Ajv()
    const schema = require(`@mixer-backend/schemas/${name}.json`)
    const validate: ValidateFunction = ajv.compile(schema)

    return validate
}

export { genValidator }
