const solc = require('solc');

const fs = require('fs');

const semaphorePath = '../semaphore/semaphorejs/contracts/'
const solidityPath = 'solidity/'

function compileInput(input, outputPath : string){

    let output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors){
            console.log(output.errors)
            process.exit(1)
    }

    if (!fs.existsSync(outputPath)){
        fs.mkdirSync(outputPath);
    }

    for (var contract in output.contracts) {
        for (var contractName in output.contracts[contract]) {
            console.log("contract ", contractName)
            let outputfile = {
                abi: output.contracts[contract][contractName].abi,
                bytecode : output.contracts[contract][contractName].evm.bytecode.object,
                }
            fs.writeFileSync(outputPath + contractName + '.json', JSON.stringify(outputfile))
        }
    }
}

function loadContract(path : string){
    return fs.readFileSync(path).toString()
}

const inputMixer = {
    language: 'Solidity',
    sources: {
        'verifier.sol': {
            content: loadContract(semaphorePath + 'verifier.sol'),
        },
        'Semaphore.sol': {
            content: loadContract(semaphorePath + 'Semaphore.sol'),
        },
        'MerkleTreeLib.sol' : {
            content: loadContract(semaphorePath + 'MerkleTreeLib.sol'),
        },
        'Ownable.sol' : {
            content: loadContract(semaphorePath + 'Ownable.sol'),
        },
        'Mixer.sol' : {
            content: loadContract(solidityPath + 'Mixer.sol'),
        },
        'openzeppelin/SafeMath.sol' : {
            content: loadContract(solidityPath + 'openzeppelin/SafeMath.sol'),
        },
        'token/IERC20.sol' : {
            content: loadContract(solidityPath + 'token/IERC20.sol'),
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': [ 'evm.bytecode.object', 'abi']
            }
        }
    }
}

compileInput(inputMixer, 'compiled/')

const inputToken = {
    language: 'Solidity',
    sources: {
        'ERC20.sol': {
            content: loadContract(solidityPath + 'token/ERC20.sol'),
        },
        'ERC20Detailed.sol' : {
            content: loadContract(solidityPath + 'token/ERC20Detailed.sol'),
        },
        'ERC20Mintable.sol' : {
            content: loadContract(solidityPath + 'token/ERC20Mintable.sol'),
        },
        'IERC20.sol' : {
            content: loadContract(solidityPath + 'token/IERC20.sol'),
        },
        'openzeppelin/SafeMath.sol' : {
            content: loadContract(solidityPath + 'openzeppelin/SafeMath.sol'),
        },
        'openzeppelin/MinterRole.sol' : {
            content: loadContract(solidityPath + 'openzeppelin/MinterRole.sol'),
        },
        'openzeppelin/Roles.sol' : {
            content: loadContract(solidityPath + 'openzeppelin/Roles.sol'),
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': [ 'evm.bytecode.object', 'abi']
            }
        }
    }
}

compileInput(inputToken, 'compiled/token/')
