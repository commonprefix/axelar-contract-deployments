# Deploy Hedera ITS contracts

Clone [Hedera fork of ITS](http://github.com/commonprefix/interchain-token-service/tree/hedera-support) and checkout the `hedera-support` branch. Make sure the ITS directory is called `hedera-interchain-token-service` and lives alongisde this repo's directory — otherwise change the path in `package.json` and reinstall dependencies via npm.

Populate the `.env` with `HEDERA_PK` and `HEDERA_ID` you can get on [Hedera Portal](http://portal.hedera.com). Use the `deploy-hts-lib.js` script to deploy the HTS library and populate the newly deployed library's address in `.env`.

You can now run `node evm/deploy-its.js -s "salt123 devnet-amplifier" --proxySalt 'salt123 devnet-amplifier' -m create2 -e devnet-amplifier -n hedera` to deploy the contracts.
