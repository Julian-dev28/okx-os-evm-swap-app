import 'dotenv/config';
import { Connection, Transaction, Keypair, PublicKey } from '@solana/web3.js';
import cryptoJS from 'crypto-js';
import base58 from 'bs58';
import fetch from 'node-fetch'; // Need this for fetch in Node.js

// Constants
const NATIVE_SOL = "11111111111111111111111111111111";
const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

// Connection setup with proper error handling
const connection = new Connection(
    `https://mainnet.helius-rpc.com/?api-key=45f9798b-9483-4c10-87b6-47dcb952a345`,
    {
        confirmTransactionInitialTimeout: 5000,
        wsEndpoint: `wss://mainnet.helius-rpc.com/?api-key=45f9798b-9483-4c10-87b6-47dcb952a345`,
    }
);

// API credentials with validation
const apiKey = process.env.REACT_APP_API_KEY;
const secretKey = process.env.REACT_APP_SECRET_KEY;
const apiPassphrase = process.env.REACT_APP_API_PASSPHRASE;
const projectId = process.env.REACT_APP_PROJECT_ID;
const userPrivateKey = process.env.REACT_APP_PRIVATE_KEY;

// Validate environment variables early
if (!apiKey || !secretKey || !apiPassphrase || !projectId || !userPrivateKey) {
    throw new Error("Missing required environment variables");
}

function getHeaders(timestamp, method, requestPath, queryString = "") {
    const stringToSign = timestamp + method + requestPath + queryString;

    return {
        "Content-Type": "application/json",
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(stringToSign, secretKey),
        ),
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": apiPassphrase,
        "OK-ACCESS-PROJECT": projectId,
    };
}

async function getSingleChainSwap(params) {
    try {
        const timestamp = new Date().toISOString();
        const requestPath = "/api/v5/dex/aggregator/swap";
        const queryString = "?" + new URLSearchParams(params).toString();
        const headers = getHeaders(timestamp, "GET", requestPath, queryString);

        console.log("Making API request with params:", params);

        const response = await fetch(
            `https://www.okx.com${requestPath}${queryString}`,
            { method: "GET", headers }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${errorText}`);
        }

        const data = await response.json();
        console.log("API response:", data);

        if (data.code !== "0") {
            throw new Error(`API Error: ${data.msg}`);
        }

        return data.data[0];
    } catch (error) {
        console.error("Failed to get swap quote:", error);
        throw error;
    }
}

async function executeSingleChainTransaction(txData) {
    try {
        console.log("Transaction data received:", txData);

        const recentBlockHash = await connection.getLatestBlockhash('processed');
        console.log("Got recent blockhash:", recentBlockHash.blockhash);

        // Ensure we have valid transaction data
        if (!txData?.tx?.data) {
            throw new Error("Invalid transaction data structure");
        }

        // Properly decode the private key
        const privateKeyBytes = base58.decode(userPrivateKey);
        console.log("Private key decoded, length:", privateKeyBytes.length);

        const feePayer = Keypair.fromSecretKey(privateKeyBytes);
        console.log("Fee payer public key:", feePayer.publicKey.toString());

        // Decode and create transaction
        const decodedTransaction = base58.decode(txData.tx.data);
        const tx = Transaction.from(decodedTransaction);
        tx.recentBlockhash = recentBlockHash.blockhash;

        tx.partialSign(feePayer);
        console.log("Transaction signed");

        const txId = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
            maxRetries: 3
        });
        console.log("Transaction sent, ID:", txId);

        // Wait for confirmation with better error handling
        let confirmation;
        for (let i = 0; i < 3; i++) {
            try {
                confirmation = await connection.confirmTransaction({
                    signature: txId,
                    blockhash: recentBlockHash.blockhash,
                    lastValidBlockHeight: recentBlockHash.lastValidBlockHeight
                }, 'processed');

                if (confirmation?.value?.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                }
                break;
            } catch (confirmError) {
                if (i === 2) {
                    const status = await connection.getSignatureStatus(txId);
                    if (status?.value?.confirmationStatus) {
                        confirmation = { value: status.value };
                        break;
                    }
                    throw new Error("Transaction could not be confirmed. Please check explorer.");
                }
                console.log(`Retry ${i + 1} for confirmation...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        return {
            success: true,
            transactionId: txId,
            explorerUrl: `https://solscan.io/tx/${txId}`,
            confirmation
        };
    } catch (error) {
        console.error("Transaction execution failed:", error);
        throw error;
    }
}

async function executeSwap(amount, fromToken = NATIVE_SOL, toToken = WRAPPED_SOL) {
    try {
        // Create keypair first to validate private key
        const privateKeyBytes = base58.decode(userPrivateKey);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);

        // Format amount with proper decimals
        const formattedAmount = formatAmountWithDecimals(amount);
        console.log(`Original amount: ${amount} SOL`);
        console.log(`Formatted amount with decimals: ${formattedAmount} lamports`);

        const swapParams = {
            chainId: "501",
            amount: formattedAmount,
            fromTokenAddress: fromToken,
            toTokenAddress: toToken,
            slippage: "0.5",
            userWalletAddress: keypair.publicKey.toString()
        };

        console.log("Getting swap quote...");
        const swapData = await getSingleChainSwap(swapParams);

        console.log("Executing swap transaction...");
        const result = await executeSingleChainTransaction(swapData);

        console.log("Swap completed successfully!");
        console.log("Transaction ID:", result.transactionId);
        console.log("Explorer URL:", result.explorerUrl);

        return result;
    } catch (error) {
        console.error("Swap execution failed:", error);
        throw error;
    }
}
const DECIMALS = 9; // SOL and WSOL both have 9 decimals

// Helper function to convert amount to proper decimal representation
function formatAmountWithDecimals(amount) {
    // Convert amount to smallest units (lamports)
    const amountInLamports = Math.floor(amount * Math.pow(10, DECIMALS));
    return amountInLamports.toString();
}

// Execute the swap
const amountToSwap = 0.15; // This will be converted to 150000000 lamports (0.15 * 10^9)

executeSwap(amountToSwap)
    .then(result => {
        console.log("Swap completed:", result);
    })
    .catch(error => {
        console.error("Error during swap:", error);
        process.exit(1);
    });