import 'dotenv/config';
import {
    Connection,
    Keypair,
    PublicKey,
    VersionedTransaction,
    sendAndConfirmRawTransaction,
    ComputeBudgetProgram
} from '@solana/web3.js';
import cryptoJS from 'crypto-js';
import base58 from 'bs58';
import fetch from 'node-fetch';

// Constants
const NATIVE_SOL = "11111111111111111111111111111111";
const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MAX_RETRIES = 3;
const DECIMALS = 9; // SOL has 9 decimals
const COMPUTE_UNITS = 300000;

// Connection setup
const connection = new Connection(
    `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
        wsEndpoint: `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    }
);

// Environment variable validation
const requiredEnvVars = {
    REACT_APP_API_KEY: process.env.REACT_APP_API_KEY,
    REACT_APP_SECRET_KEY: process.env.REACT_APP_SECRET_KEY,
    REACT_APP_API_PASSPHRASE: process.env.REACT_APP_API_PASSPHRASE,
    REACT_APP_PROJECT_ID: process.env.REACT_APP_PROJECT_ID,
    REACT_APP_PRIVATE_KEY: process.env.REACT_APP_PRIVATE_KEY,
    HELIUS_API_KEY: process.env.HELIUS_API_KEY
};

// Validate environment variables
function validateEnvironment() {
    const missing = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

// OKX API header generation
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

// Get swap quote from OKX API
async function getSingleChainSwap(params) {
    const timestamp = new Date().toISOString();
    const requestPath = "/api/v5/dex/aggregator/swap";
    const queryString = "?" + new URLSearchParams(params).toString();
    const headers = getHeaders(timestamp, "GET", requestPath, queryString);

    console.log("Requesting swap quote with params:", params);

    const response = await fetch(
        `https://www.okx.com${requestPath}${queryString}`,
        { method: "GET", headers }
    );

    if (!response.ok) {
        throw new Error(`API request failed: ${await response.text()}`);
    }

    const data = await response.json();
    console.log("Full API Response:", JSON.stringify(data, null, 2));

    if (data.code !== "0") {
        throw new Error(`API Error: ${data.msg}`);
    }

    if (!data.data?.[0]) {
        throw new Error("No swap data received");
    }

    return data.data[0];
}

// Token account validation
async function validateTokenAccounts(wallet, fromToken, toToken) {
    try {
        if (toToken !== NATIVE_SOL) {
            const toAccounts = await connection.getTokenAccountsByOwner(wallet, {
                mint: new PublicKey(toToken)
            });

            if (toAccounts.value.length === 0) {
                console.warn("No token account found for destination token");
                // Let the transaction create the account
            }
        }
    } catch (error) {
        console.error("Token account validation error:", error);
        throw error;
    }
}

// Execute the transaction
async function executeSingleChainTransaction(txData) {
    if (!txData?.tx?.data) {
        throw new Error('Invalid transaction data received from OKX');
    }

    let retryCount = 0;
    while (retryCount < MAX_RETRIES) {
        try {
            const blockhash = await connection.getLatestBlockhash('confirmed');
            const privateKeyBytes = base58.decode(requiredEnvVars.REACT_APP_PRIVATE_KEY);
            const feePayer = Keypair.fromSecretKey(privateKeyBytes);

            console.log(`Transaction attempt ${retryCount + 1}/${MAX_RETRIES}`);
            console.log("Using blockhash:", blockhash.blockhash);
            console.log("Fee payer:", feePayer.publicKey.toString());

            // Decode and prepare transaction
            const decodedTransaction = base58.decode(txData.tx.data);
            const tx = VersionedTransaction.deserialize(decodedTransaction);

            // Add compute budget instruction
            const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: COMPUTE_UNITS
            });

            // Update blockhash and sign
            tx.message.recentBlockhash = blockhash.blockhash;
            tx.sign([feePayer]);

            const txId = await sendAndConfirmRawTransaction(
                connection,
                tx.serialize(),
                {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                    maxRetries: 5
                }
            );

            console.log("Transaction sent:", txId);
            return {
                success: true,
                transactionId: txId,
                explorerUrl: `https://solscan.io/tx/${txId}`
            };
        } catch (error) {
            console.error(`Attempt ${retryCount + 1} failed:`, error);
            retryCount++;

            if (retryCount === MAX_RETRIES) {
                throw error;
            }

            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        }
    }
}

// Format amount with proper decimals
function formatAmountWithDecimals(amount) {
    return Math.floor(amount * Math.pow(10, DECIMALS)).toString();
}

async function executeSwap(amount, fromToken = NATIVE_SOL, toToken = USDC_SOL) {
    try {
        validateEnvironment();

        const privateKeyBytes = base58.decode(requiredEnvVars.REACT_APP_PRIVATE_KEY);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const formattedAmount = formatAmountWithDecimals(amount);

        await validateTokenAccounts(keypair.publicKey, fromToken, toToken);

        const swapParams = {
            chainId: "501",
            amount: formattedAmount,
            fromTokenAddress: fromToken,
            toTokenAddress: toToken,
            slippage: "0.5", // Reduced slippage for better protection
            userWalletAddress: keypair.publicKey.toString()
        };

        const swapData = await getSingleChainSwap(swapParams);

        // Validate output amount
        if (swapData.routerResult.toTokenAmount === '0') {
            throw new Error('Zero output amount detected');
        }

        return await executeSingleChainTransaction(swapData);
    } catch (error) {
        console.error("Detailed swap error:", error);
        throw error;
    }
}

// Execute the swap
const amountToSwap = 0.05;

executeSwap(amountToSwap)
    .then(result => {
        console.log("Swap completed successfully:", result);
        process.exit(0);
    })
    .catch(error => {
        console.error("Swap failed:", error);
        process.exit(1);
    });