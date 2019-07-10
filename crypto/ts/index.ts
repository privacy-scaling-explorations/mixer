import * as crypto from 'crypto'
import * as circomlib from 'circomlib'
import * as snarkjs from 'snarkjs'
import * as ethers from 'ethers'
const eddsa = circomlib.eddsa
const bigInt = snarkjs.bigInt

import MemStorage from './memStorage'
const MerkleTreeJs = require('zkp-sbmtjs/src/tree')
const MimcSpongeHasher = require('zkp-sbmtjs/src/hasher/mimcsponge')

import { convertWitness, prove, beBuff2int } from './utils'

type EddsaPrivateKey = Buffer
type EddsaPublicKey = BigInt[]
type SnarkProvingKey = Buffer
type SnarkVerifyingKey = Buffer

interface EddsaKeyPair {
    pubKey: EddsaPublicKey,
    privKey: EddsaPrivateKey,
}

interface Identity {
    keypair: EddsaKeyPair,
    identityNullifier: BigInt,
}

const genRandomBuffer = (numBytes: number = 32) => {
    return crypto.randomBytes(numBytes)
}

// The identity nullifier is a random 31-byte value
const genIdentityNullifier = (
    randomBytes: Buffer = genRandomBuffer(31),
): BigInt => {
    return bigInt(snarkjs.bigInt.leBuff2int(randomBytes))
}

const genCircuit = (cirDef: any) => {
    return new snarkjs.Circuit(cirDef)
}

const genTree = async (leaves: snarkjs.bigInt[]) => {
    const tree = setupTree()

    for (let i=0; i<leaves.length; i++) {
        await tree.update(i, leaves[i])
    }

    return tree
}

const pedersenHash = (ints: snarkjs.bigInt[]) => {
    const p = circomlib.babyJub.unpackPoint(
        circomlib.pedersenHash.hash(
            Buffer.concat(
             ints.map(x => x.leInt2Buff(32))
            )
        )
    )

    return bigInt(p[0])
}

// The identity commitment is the hash of the public key and the identity nullifier
const genIdentityCommitment = (
    identityNullifier: BigInt,
    pubKey: EddsaPublicKey,
) => {

    return pedersenHash([
        bigInt(circomlib.babyJub.mulPointEscalar(pubKey, 8)[0]),
        bigInt(identityNullifier)
    ])
}

const genPubKey = (privKey: EddsaPrivateKey) => {
    const pubKey = eddsa.prv2pub(privKey)

    return pubKey
}

const genEddsaKeyPair = (
    privKey: Buffer = genRandomBuffer(),
): EddsaKeyPair => {

    const pubKey = genPubKey(privKey)
    return { pubKey, privKey }
}

const genIdentity = (
    privKey: Buffer = genRandomBuffer(32),
    randomBytes: Buffer = genRandomBuffer(31),
): Identity => {

    return {
        keypair: genEddsaKeyPair(privKey),
        identityNullifier: genIdentityNullifier(randomBytes),
    }
}

const genMsg = (
    externalNullifier: string,
    signalHash: BigInt,
    broadcasterAddress: string,
): BigInt => {

    return circomlib.mimcsponge.multiHash([
        bigInt(externalNullifier),
        bigInt(signalHash), 
        bigInt(broadcasterAddress),
    ])
}

const signMsg = (
    privKey: EddsaPrivateKey,
    msg: BigInt,
): BigInt => {

    return eddsa.signMiMCSponge(privKey, msg)
}

const genSignedMsg = (
    privKey: EddsaPrivateKey,
    externalNullifier: string,
    signalHash: BigInt,
    broadcasterAddress: string,
) => {
    const msg = genMsg(externalNullifier, signalHash, broadcasterAddress)

    return {
        msg,
        signature: signMsg(privKey, msg),
    }
}

const genPathElementsAndIndex = async (tree, identityCommitment) => {
    const leafIndex = await tree.element_index(identityCommitment)
    const identityPath = await tree.path(leafIndex)
    const identityPathElements = identityPath.path_elements
    const identityPathIndex = identityPath.path_index
    return { identityPathElements, identityPathIndex }

}

const verifySignature = (
    msg: BigInt,
    signature: BigInt,
    pubKey: EddsaPublicKey,
): boolean => {

    return eddsa.verifyMiMCSponge(msg, signature, pubKey)
}

// calculate the signal, which is the keccak256 hash of
// recipientAddress, broadcasterAddress, and fee.
const genSignalAndSignalHash = (
    recipientAddress, broadcasterAddress, feeAmt,
) => {
    const signal = ethers.utils.solidityKeccak256(
        ['address', 'address', 'uint256'],
        [recipientAddress, broadcasterAddress, feeAmt],
    )

    const signalAsBuffer = Buffer.from(signal.slice(2), 'hex')
    const signalHashRaw = crypto.createHash('sha256').update(signalAsBuffer).digest()
    const signalHash = beBuff2int(signalHashRaw.slice(0, 31))

    return { signal, signalHash }
}

const genWitness = (
    circuit: snarkjs.Circuit,
    pubKey: EddsaPublicKey,
    signature,
    signalHash,
    externalNullifier,
    identityNullifier,
    identityPathElements,
    identityPathIndex: number,
    broadcasterAddress: string,
) => {

    return circuit.calculateWitness({
        'identity_pk[0]': pubKey[0],
        'identity_pk[1]': pubKey[1],
        'auth_sig_r[0]': signature.R8[0],
        'auth_sig_r[1]': signature.R8[1],
        auth_sig_s: signature.S,
        signal_hash: signalHash,
        external_nullifier: externalNullifier,
        identity_nullifier: identityNullifier,
        identity_path_elements: identityPathElements,
        identity_path_index: identityPathIndex,
        broadcaster_address: broadcasterAddress,
    })
}

const extractWitnessRoot = (
    circuit: snarkjs.Circuit,
    witness: any
) => {

    return witness[circuit.getSignalIdx('main.root')]
}

const genProof = async (
    witness: any,
    provingKeyBuffer: Buffer,
) => {

    const witnessBin = convertWitness(snarkjs.stringifyBigInts(witness))

    return await prove(witnessBin.buffer, provingKeyBuffer)
}

const genPublicSignals = (
    witness: any,
    circuit: snarkjs.Circuit,
) => {

    return witness.slice(1, circuit.nPubInputs + circuit.nOutputs+1)
}

const verifyProof = (
    verifyingKey: any,
    proof: any,
    publicSignals: any,
) => {

    return snarkjs.groth.isValid(verifyingKey, proof, publicSignals)
}

const unstringifyBigInts = snarkjs.unstringifyBigInts

const setupTree = () => {
    const storage = new MemStorage()
    const hasher = new MimcSpongeHasher()
    const prefix = 'semaphore'

    return new MerkleTreeJs(
        prefix,
        storage,
        hasher,
        20,
        0,
    )
}

export {
    EddsaKeyPair,
    Identity,
    genPubKey,
    genIdentity,
    genEddsaKeyPair,
    genRandomBuffer,
    genIdentityCommitment,
    genIdentityNullifier,
    genCircuit,
    genTree,
    EddsaPrivateKey,
    EddsaPublicKey,
    SnarkProvingKey,
    SnarkVerifyingKey,
    genMsg,
    signMsg,
    genSignedMsg,
    verifySignature,
    genPathElementsAndIndex,
    genSignalAndSignalHash,
    genWitness,
    extractWitnessRoot,
    genProof,
    genPublicSignals,
    verifyProof,
    unstringifyBigInts,
    setupTree,
    MemStorage,
    bigInt,
}
