import * as Artifactor from 'truffle-artifactor'
const mimcGenContract = require('circomlib/src/mimcsponge_gencontract.js');

const SEED = 'mimcsponge'

const buildMiMC = async (outputPath : string) => {
    const artifactor = new Artifactor(outputPath)
    await artifactor.save({
        contractName: 'MiMC',
        abi: mimcGenContract.abi,
        unlinked_binary: mimcGenContract.createCode(SEED, 220),
    })
}

if (require.main === module) {
    const outputPath = 'compiled/'

    buildMiMC(outputPath)
}

export default buildMiMC
