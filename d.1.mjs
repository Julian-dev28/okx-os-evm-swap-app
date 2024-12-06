import {
    Connection,
    Keypair,
    PublicKey,
    VersionedTransaction,
    sendAndConfirmRawTransaction,
} from '@solana/web3.js';
import cryptoJS from 'crypto-js';
import base58 from 'bs58';
import fetch from 'node-fetch';
import 'dotenv/config';
// Constants
const NATIVE_SOL = "11111111111111111111111111111111";
const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const MAX_RETRIES = 6;
const DECIMALS = 9;

// Connection setup
const connection = new Connection(
    // `https://lb.drpc.org/ogrpc?network=solana&dkey=AgURgE2Z0EJ_o3WCGjHBCUfFTr7Hs1ER75s6uivZK8k9`,
    // `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    // `https://solana-mainnet.g.alchemy.com/v2/hWHVoXxpR4XpLbjTf4cOKfEwXdgGlc7R`,
    // 'https://special-few-orb.solana-mainnet.quiknode.pro/de3e2b8aefef57703c1785646c453f3edf09b147',
    // 'https://solana-mainnet.gateway.tatum.io/t-675223f2ba9501914e5bf12f-b31f23699cf949ff9d664122',



    'https://solana-mainnet.gateway.tatum.io/',
    {
        httpHeaders: {
            'x-api-key': 't-675223f2ba9501914e5bf12f-b31f23699cf949ff9d664122'
        },
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000
    },
    {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
        // wsEndpoint: `wss://lb.drpc.org/ogws?network=solana&dkey=AgURgE2Z0EJ_o3WCGjHBCUfFTr7Hs1ER75s6uivZK8k9`
        // wsEndpoint: `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
        // wsEndpoint: 'wss://special-few-orb.solana-mainnet.quiknode.pro/de3e2b8aefef57703c1785646c453f3edf09b147',
    }
);

// Environment variable validation
const requiredEnvVars = {
    REACT_APP_API_KEY: process.env.REACT_APP_API_KEY,
    REACT_APP_SECRET_KEY: process.env.REACT_APP_SECRET_KEY,
    REACT_APP_API_PASSPHRASE: process.env.REACT_APP_API_PASSPHRASE,
    REACT_APP_PROJECT_ID: process.env.REACT_APP_PROJECT_ID,
    REACT_APP_PRIVATE_KEY: process.env.REACT_APP_PRIVATE_KEY,
    REACT_APP_ETH_ADDRESS: process.env.REACT_APP_ETH_ADDRESS,
    HELIUS_API_KEY: process.env.HELIUS_API_KEY
};

function validateEnvironment() {
    const missing = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

function getHeaders(timestamp, method, requestPath, queryString = "") {
    const stringToSign = timestamp + method + requestPath + queryString;
    return {
        "Content-Type": "application/json",
        "OK-ACCESS-KEY": requiredEnvVars.REACT_APP_API_KEY,
        "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(stringToSign, requiredEnvVars.REACT_APP_SECRET_KEY)
        ),
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": requiredEnvVars.REACT_APP_API_PASSPHRASE,
        "OK-ACCESS-PROJECT": requiredEnvVars.REACT_APP_PROJECT_ID,
    };
}

function formatAmount(amount) {
    return Math.floor(amount * Math.pow(10, DECIMALS)).toString();
}

// Cross-chain quote function
async function getCrossChainQuote(params) {
    const timestamp = new Date().toISOString();
    const requestPath = "/api/v5/dex/cross-chain/quote";
    const queryString = "?" + new URLSearchParams(params).toString();
    const headers = getHeaders(timestamp, "GET", requestPath, queryString);

    console.log("Requesting cross-chain quote with params:", params);

    const response = await fetch(
        `https://www.okx.com${requestPath}${queryString}`,
        { method: "GET", headers }
    );

    const data = await response.json();
    console.log("Full API Response:", JSON.stringify(data, null, 2));

    if (data.code !== "0") {
        throw new Error(`API Error: ${data.msg}`);
    }

    return data;
}

// Build transaction function
async function getBuildTx(params) {
    const timestamp = new Date().toISOString();
    const requestPath = "/api/v5/dex/cross-chain/build-tx";
    const queryString = "?" + new URLSearchParams(params).toString();
    const headers = getHeaders(timestamp, "GET", requestPath, queryString);

    console.log("Requesting build tx with params:", params);

    const response = await fetch(
        `https://www.okx.com${requestPath}${queryString}`,
        { method: "GET", headers }
    );

    const data = await response.json();
    if (data.code !== "0") {
        throw new Error(`API Error: ${data.msg}`);
    }

    return data;
}





async function executeTransaction(txData) {
    if (!txData?.tx?.data) {
        throw new Error('Invalid transaction data received from OKX');
    }

    let retryCount = 0;
    while (retryCount < MAX_RETRIES) {
        try {
            const blockhash = await connection.getLatestBlockhash('processed');
            const privateKeyBytes = base58.decode(requiredEnvVars.REACT_APP_PRIVATE_KEY);
            const feePayer = Keypair.fromSecretKey(privateKeyBytes);

            // Add balance check for Tatum
            const balance = await connection.getBalance(feePayer.publicKey);
            if (balance < 1000000) {
                throw new Error('Insufficient balance for transaction fees');
            }

            const decodedTransaction = base58.decode(txData.tx.data);
            const tx = VersionedTransaction.deserialize(decodedTransaction);

            // Create new transaction with updated blockhash
            const newTx = new VersionedTransaction(tx.message);
            newTx.message.recentBlockhash = blockhash.blockhash;

            // Clear existing signatures and sign
            newTx.signatures = [];
            newTx.sign([feePayer]);

            // Try using sendAndConfirmRawTransaction instead
            const signature = await sendAndConfirmRawTransaction(
                connection,
                newTx.serialize(),
                {
                    skipPreflight: false,
                    maxRetries: 5,
                    preflightCommitment: 'processed'
                }
            );

            return {
                success: true,
                transactionId: signature,
                explorerUrl: `https://solscan.io/tx/${signature}`
            };

        } catch (error) {
            console.error(`Attempt ${retryCount + 1} failed:`, error);

            // Check for Tatum-specific errors
            if (error.message?.includes('Server error') ||
                error.message?.includes('timeout')) {
                retryCount++;
                if (retryCount === MAX_RETRIES) throw error;
                await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
                continue;
            }

            throw error;
        }
    }
}

async function executeCrossChainSwap(amount) {
    try {
        validateEnvironment();

        const privateKeyBytes = base58.decode(requiredEnvVars.REACT_APP_PRIVATE_KEY);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const formattedAmount = formatAmount(amount);

        // Get quote first
        const quoteParams = {
            fromChainId: "501",
            toChainId: "137",
            fromTokenAddress: NATIVE_SOL,
            toTokenAddress: ETH,
            amount: formattedAmount,
            slippage: "0.5",
            priceImpactProtectionPercentage: "0.9",
        };

        await getCrossChainQuote(quoteParams);

        // Build transaction
        const buildTxParams = {
            ...quoteParams,
            userWalletAddress: keypair.publicKey.toString(),
            receiveAddress: requiredEnvVars.REACT_APP_ETH_ADDRESS.toString(),
        };

        const txData = await getBuildTx(buildTxParams);
        return await executeTransaction(txData.data[0]);
    } catch (error) {
        console.error("Detailed cross-chain swap error:", error);
        throw error;
    }
}

// Execute the swap
const amountToSwap = 0.15;

executeCrossChainSwap(amountToSwap)
    .then(result => {
        console.log("Cross-chain swap completed successfully:", result);
        process.exit(0);
    })
    .catch(error => {
        console.error("Cross-chain swap failed:", error);
        process.exit(1);
    });