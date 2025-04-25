'use strict';

require('dotenv').config();
const { Client, PrivateKey, ContractCreateFlow, AccountId } = require('@hashgraph/sdk');
const { getContractJSON } = require('../evm/utils.js');

function contractIdToEvmAddress(shard, realm, num) {
    const buf = Buffer.alloc(20);
    buf.writeUInt32BE(shard, 0);
    buf.writeBigUInt64BE(BigInt(realm), 4);
    buf.writeBigUInt64BE(BigInt(num), 12);
    return '0x' + buf.toString('hex');
}

async function main() {
    if (!process.env.HEDERA_PK || !process.env.HEDERA_ID) {
        console.error('Error: HEDERA_PK and HEDERA_ID must be set in the environment variables.');
        console.error('Please set these values in your .env file and try again.');
        process.exit(1);
    }

    // Initialize the Hedera client
    const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PK);
    const operatorId = AccountId.fromString(process.env.HEDERA_ID);

    const client = Client.forTestnet().setOperator(operatorId, operatorKey);

    const json = getContractJSON('HTS');
    const bytecode = json.bytecode;

    console.log('Deploying HTS library');

    // Create the transaction
    const contractCreate = new ContractCreateFlow().setGas(500000).setBytecode(bytecode);

    // Sign the transaction with the client operator key and submit to a Hedera network
    const txResponse = contractCreate.execute(client);

    // Get the receipt of the transaction
    const receipt = await (await txResponse).getReceipt(client);

    // Get the new contract ID
    const newContractId = receipt.contractId;
    console.log('The new contract ID is ' + newContractId);

    const evmAddress = contractIdToEvmAddress(newContractId.shard, newContractId.realm, newContractId.num);

    console.log(`Add the following line in .env:\nHTS_LIB_ADDRESS="${evmAddress}"`);

    process.exit(0);
}

main();
