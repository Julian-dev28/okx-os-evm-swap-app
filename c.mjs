import {
    Connection,
    Keypair,
    PublicKey,
    VersionedTransaction,
} from '@solana/web3.js';
import cryptoJS from 'crypto-js';
import base58 from 'bs58';
import fetch from 'node-fetch';
import 'dotenv/config';

// Constants
const NATIVE_SOL = "11111111111111111111111111111111";
const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const MAX_RETRIES = 20;
const DECIMALS = 9;
const MIN_BALANCE = 1000000; // 0.001 SOL
const QUOTE_EXPIRATION = 30000; // 30 seconds

// RPC endpoints for failover
const RPC_ENDPOINTS = [
    'https://solana-mainnet.gateway.tatum.io/',
    'https://api.mainnet-beta.solana.com',
];

// Connection setup with failover
async function getWorkingConnection() {
    for (const endpoint of RPC_ENDPOINTS) {
        try {
            const connection = new Connection(endpoint, {
                commitment: 'confirmed',
                confirmTransactionInitialTimeout: 120000
            });
            await connection.getSlot();
            return connection;
        } catch (error) {
            console.warn(`Failed to connect to ${endpoint}, trying next...`);
        }
    }
    throw new Error('All RPC endpoints failed');
}

// Initialize connection
const connection = await getWorkingConnection();

// Environment variable validation
const requiredEnvVars = {
    REACT_APP_API_KEY: process.env.REACT_APP_API_KEY,
    REACT_APP_SECRET_KEY: process.env.REACT_APP_SECRET_KEY,
    REACT_APP_API_PASSPHRASE: process.env.REACT_APP_API_PASSPHRASE,
    REACT_APP_PROJECT_ID: process.env.REACT_APP_PROJECT_ID,
    REACT_APP_PRIVATE_KEY: process.env.REACT_APP_PRIVATE_KEY,
    REACT_APP_ETH_ADDRESS: process.env.REACT_APP_ETH_ADDRESS
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
    console.log("Quote API Response:", JSON.stringify(data, null, 2));

    if (data.code !== "0") {
        throw new Error(`Quote API Error: ${data.msg}`);
    }

    return data;
}

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
    console.log("Build TX API Response:", JSON.stringify(data, null, 2));

    if (data.code !== "0") {
        throw new Error(`Build TX API Error: ${data.msg}`);
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
            const privateKeyBytes = base58.decode(requiredEnvVars.REACT_APP_PRIVATE_KEY);
            const feePayer = Keypair.fromSecretKey(privateKeyBytes);

            // Check balance
            const balance = await connection.getBalance(feePayer.publicKey);
            if (balance < MIN_BALANCE) {
                throw new Error(`Insufficient balance: ${balance / 1e9} SOL`);
            }

            const timestamp = new Date().toISOString();
            const requestPath = "/api/v5/wallet/broadcast-transaction";
            const headers = getHeaders(timestamp, "POST", requestPath);

            // Prepare broadcast body
            const broadcastBody = {
                signedTx: txData.tx.data,
                chainIndex: "501",
                address: feePayer.publicKey.toString()
            };

            console.log("Broadcasting transaction:", broadcastBody);

            // Send broadcast request
            const response = await fetch(
                `https://www.okx.com${requestPath}`,
                {
                    method: "POST",
                    headers: {
                        ...headers,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(broadcastBody)
                }
            );

            const result = await response.json();
            console.log("Broadcast Response:", JSON.stringify(result, null, 2));

            if (result.code !== "0") {
                throw new Error(`Broadcast Error: ${result.msg}`);
            }

            // Get signature and confirm transaction
            const signature = result.data[0].orderId;
            console.log("Transaction signature:", signature);

            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            console.log("Transaction confirmation:", confirmation);

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            return {
                success: true,
                transactionId: signature,
                explorerUrl: `https://solscan.io/tx/${signature}`,
                confirmation
            };

        } catch (error) {
            console.error(`Attempt ${retryCount + 1} failed:`, error);

            if (error.logs) {
                console.error('Transaction logs:', error.logs);
            }

            if (error.message.includes('insufficient balance')) {
                throw error; // Don't retry balance errors
            }

            retryCount++;
            if (retryCount === MAX_RETRIES) {
                throw error;
            }

            // Exponential backoff
            const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 30000);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
    }
}

async function executeCrossChainSwap(amount) {
    try {
        validateEnvironment();

        if (amount <= 0) {
            throw new Error('Invalid swap amount');
        }

        const privateKeyBytes = base58.decode(requiredEnvVars.REACT_APP_PRIVATE_KEY);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const formattedAmount = formatAmount(amount);

        // Get quote
        const quoteParams = {
            fromChainId: "501",
            toChainId: "137",
            fromTokenAddress: NATIVE_SOL,
            toTokenAddress: ETH,
            amount: formattedAmount,
            slippage: "0.5",
            priceImpactProtectionPercentage: "0.9",
        };

        const quote = await getCrossChainQuote(quoteParams);

        // Build transaction
        const buildTxParams = {
            ...quoteParams,
            userWalletAddress: keypair.publicKey.toString(),
            receiveAddress: requiredEnvVars.REACT_APP_ETH_ADDRESS,
        };

        const txData = await getBuildTx(buildTxParams);
        return await executeTransaction(txData.data[0]);
    } catch (error) {
        console.error("Cross-chain swap error:", error);
        throw error;
    }
}

// Execute the swap
const amountToSwap = 0.05;

executeCrossChainSwap(amountToSwap)
    .then(result => {
        console.log("Cross-chain swap completed successfully:", result);
        process.exit(0);
    })
    .catch(error => {
        console.error("Cross-chain swap failed:", error);
        process.exit(1);
    });