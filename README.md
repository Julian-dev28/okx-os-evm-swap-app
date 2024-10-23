# OKX DEX Swap Application

This project demonstrates how to build a token swap application on the EVM network using the OKX DEX API. The example shows how to swap ETH for USDC on the Ethereum network.

## Features

- Check token allowances
- Approve tokens for swapping
- Get quotes for token swaps
- Execute token swaps

## Prerequisites

- Node.js and npm installed
- An Ethereum wallet with private key
- [OKX API credentials (API Key, Secret Key, and Passphrase)](https://www.okx.com/web3/build/dev-portal)

## Installation

1. Fork the repository:

- Click "Use Template" to fork this repl.
  
2. Install the dependencies

In Replit, open the shell terminal and run the following command:
```bash
npm install
```

3. Run the project:

- Use the `Run` button provided by Replit to start the application.
- Once the server starts, it will provide a webview window with the application running live.


4. Set up your environment variables (consider using a `.env` file):
   - `CHAIN_ID`
   - `FROM_TOKEN_ADDRESS`
   - `TO_TOKEN_ADDRESS`
   - `USER_WALLET_ADDRESS`
   - `PRIVATE_KEY` (Wallet Private Key)
   - `OKX_API_KEY`
   - `OKX_SECRET_KEY`
   - `OKX_PASSPHRASE`

## Usage

1. Set up your environment and initialize Web3 connection.
2. Check token allowances using the `getAllowance` function.
3. If needed, approve tokens using the `sendApproveTx` function.
4. Get a quote for your swap using the `getQuote` function.
5. Execute the swap using the `sendSwapTx` function.

## Important Notes

- Always ensure you have sufficient gas for transactions.
- Be cautious with private keys and API credentials. Never share them publicly.
- This example uses a 3% slippage tolerance. Adjust as needed.

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to check [issues page](https://github.com/julian-dev28/okx-dex-swap/issues) if you want to contribute.

## License

[MIT](https://choosealicense.com/licenses/mit/)
