'use strict';

require('../common/cli-utils');

const { Command } = require('commander');
const { addAmplifierOptions } = require('./cli-utils');
const { GasPrice, calculateFee } = require('@cosmjs/stargate');

const { loadConfig, getCurrentVerifierSet, printInfo, sleep, printError } = require('../common');
const { prepareWallet, prepareClient } = require('./utils');

const executeTransaction = async (client, account, contractAddress, message, fee) => {
    const tx = await client.execute(account.address, contractAddress, message, fee, '');
    return tx;
};

const getNextVerifierSet = async (config, chain, client) => {
    return client.queryContractSmart(config.axelar.contracts.MultisigProver[chain].address, 'next_verifier_set');
};

const getVerifierSetStatus = async (config, chain, client, verifierStatus) => {
    return client.queryContractSmart(config.axelar.contracts.VotingVerifier[chain].address, { verifier_set_status: verifierStatus });
};

const updateVerifierSet = async (config, [chain], wallet, client, fee) => {
    const [account] = await wallet.getAccounts();

    const currentVerifierSet = await getCurrentVerifierSet(config, chain, client);
    printInfo('Current verifier set', currentVerifierSet);

    const { transactionHash, events } = await executeTransaction(
        client,
        account,
        config.axelar.contracts.MultisigProver[chain].address,
        'update_verifier_set',
        fee,
    );
    printInfo('Update Verifier set', transactionHash);
    const multisigSessionId = events
        .find((e) => e.type === 'wasm-proof_under_construction')
        .attributes.find((a) => a.key === 'multisig_session_id').value;
    printInfo('Mutisig session ID', multisigSessionId);
};

const confirmVerifierRotation = async (config, [chain, txHash], wallet, client, fee) => {
    const [account] = await wallet.getAccounts();

    const nextVerifierSet = (await getNextVerifierSet(config, chain, client)).verifier_set;
    printInfo('Next verifier set', nextVerifierSet);

    const verificationSet = {
        verify_verifier_set: {
            message_id: `${txHash}-0`,
            new_verifier_set: nextVerifierSet,
        },
    };
    let { transactionHash } = await executeTransaction(
        client,
        account,
        config.axelar.contracts.VotingVerifier[chain].address,
        verificationSet,
        fee,
    );
    printInfo('Initiate verifier set verification', transactionHash);

    let rotationPollStatus = await getVerifierSetStatus(config, chain, client, nextVerifierSet);

    while (rotationPollStatus === 'in_progress') {
        await sleep(1000);
        rotationPollStatus = await getVerifierSetStatus(config, chain, client, nextVerifierSet);
    }

    if (rotationPollStatus !== 'succeeded_on_source_chain') {
        printError('Poll failed for verifier set rotation with message', rotationPollStatus);
        process.exit(0);
    }

    printInfo('Poll passed for verifier set rotation');

    transactionHash = (
        await executeTransaction(client, account, config.axelar.contracts.MultisigProver[chain].address, 'confirm_verifier_set', fee)
    ).transactionHash;
    printInfo('Confirm verifier set rotation', transactionHash);
};

const processCommand = async (processCmd, options, args) => {
    const config = loadConfig(options.env);
    const wallet = await prepareWallet(options);
    const client = await prepareClient(config, wallet);
    const {
        axelar: { gasPrice, gasLimit },
    } = config;

    const fee = gasLimit === 'auto' ? 'auto' : calculateFee(gasLimit, GasPrice.fromString(gasPrice));

    await processCmd(config, args, wallet, client, fee);
};

const programHandler = () => {
    const program = new Command();

    program.name('rotate-signers').description('Rotate signers');

    const updateVerifiersCmd = program
        .command('update-verifier-set <chain>')
        .description('Update verifier set')
        .action((chain, options) => {
            processCommand(updateVerifierSet, options, [chain]);
        });
    addAmplifierOptions(updateVerifiersCmd, {});

    const confirmVerifiersCmd = program
        .command('confirm-verifier-rotation <chain> <txHash>')
        .description('Confirm verifier rotation')
        .action((chain, txHash, options) => {
            processCommand(confirmVerifierRotation, options, [chain, txHash]);
        });
    addAmplifierOptions(confirmVerifiersCmd, {});

    program.parse();
};

if (require.main === module) {
    programHandler();
}
