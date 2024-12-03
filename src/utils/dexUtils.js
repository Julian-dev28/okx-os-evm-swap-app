import base58 from "bs58"; // Changed import
const solanaWeb3 = require("@solana/web3.js");
const { Connection } = require("@solana/web3.js");
const cryptoJS = require("crypto-js");

// Use a reliable RPC endpoint
// mainnet.helius-rpc.com/?api-key=45f9798b-9483-4c10-87b6-47dcb952a345
export const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=45f9798b-9483-4c10-87b6-47dcb952a345", {
    confirmTransactionInitialTimeout: 5000,
    wsEndpoint: "wss://mainnet.helius-rpc.com/?api-key=45f9798b-9483-4c10-87b6-47dcb952a345",
});

// Environment variables
const apiKey = process.env.REACT_APP_API_KEY;
const secretKey = process.env.REACT_APP_SECRET_KEY;
const apiPassphrase = process.env.REACT_APP_API_PASSPHRASE;
const projectId = process.env.REACT_APP_PROJECT_ID;
export const userPrivateKey = process.env.REACT_APP_PRIVATE_KEY;
export const userAddress = process.env.REACT_APP_USER_ADDRESS;

// Constants
export const NATIVE_SOL = "11111111111111111111111111111111";
export const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
export const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"; // "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" WMATIC on Polygon
export const SOLANA_CHAIN_ID = "501";

// Base headers function
function getHeaders(timestamp, method, requestPath, queryString = "") {
    if (!apiKey || !secretKey || !apiPassphrase || !projectId) {
        throw new Error("Missing required environment variables");
    }

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

// Regular DEX quote function
export async function getQuote(quoteParams) {
    if (
        !quoteParams.amount ||
        !quoteParams.fromTokenAddress ||
        !quoteParams.toTokenAddress
    ) {
        throw new Error("Missing required parameters for quote");
    }

    const timestamp = new Date().toISOString();
    const params = {
        chainId: SOLANA_CHAIN_ID,
        amount: quoteParams.amount,
        fromTokenAddress: quoteParams.fromTokenAddress,
        toTokenAddress: quoteParams.toTokenAddress,
        slippage: quoteParams.slippage || "0.05",
    };

    const requestPath = "/api/v5/dex/aggregator/quote";
    const queryString = new URLSearchParams(params).toString();
    const headers = getHeaders(
        timestamp,
        "GET",
        requestPath,
        "?" + queryString,
    );

    try {
        const response = await fetch(
            `https://www.okx.com${requestPath}?${queryString}`,
            {
                method: "GET",
                headers: headers,
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get quote: ${errorText}`);
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            throw new Error("No quote data received");
        }

        return data;
    } catch (error) {
        console.error("Quote request failed:", error);
        throw error;
    }
}

// Liquidity check function
export async function getLiquidity(params = {}) {
    const timestamp = new Date().toISOString();
    const liquidityParams = {
        chainId: params.chainId || SOLANA_CHAIN_ID,
    };

    const requestPath = "/api/v5/dex/aggregator/get-liquidity";
    const queryString = new URLSearchParams(liquidityParams).toString();
    const headers = getHeaders(
        timestamp,
        "GET",
        requestPath,
        "?" + queryString,
    );

    try {
        const response = await fetch(
            `https://www.okx.com${requestPath}?${queryString}`,
            {
                method: "GET",
                headers: headers,
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get liquidity: ${errorText}`);
        }

        const data = await response.json();
        if (!data.data) {
            throw new Error("Invalid liquidity response format");
        }

        return data;
    } catch (error) {
        console.error("Liquidity request failed:", error);
        throw error;
    }
}

// Helper function for DEX information
export function getDexInfoById(liquiditySources, dexId) {
    if (!Array.isArray(liquiditySources) || !dexId) {
        console.warn("Invalid parameters for DEX info lookup");
        return null;
    }

    return (
        liquiditySources.find((source) => source.id === dexId.toString()) ||
        null
    );
}

export async function getCrossChainQuote(params) {
    const quoteParams = {
        fromChainId: params.fromChainId,
        toChainId: params.toChainId,
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        amount: formatAmount(params.amount), // Format amount properly
        slippage: params.slippage,
        userWalletAddress: params.userWalletAddress,
        priceImpactProtectionPercentage: params.priceImpactProtectionPercentage,
    };

    const timestamp = new Date().toISOString();
    const requestPath = "/api/v5/dex/cross-chain/build-tx";
    const queryString = new URLSearchParams(quoteParams).toString();
    const headers = getHeaders(
        timestamp,
        "GET",
        requestPath,
        "?" + queryString,
    );

    try {
        console.log("Quote request params:", quoteParams);

        const response = await fetch(
            `https://www.okx.com${requestPath}?${queryString}`,
            {
                method: "GET",
                headers: headers,
            },
        );

        const data = await response.json();
        console.log("Quote response:", data);

        if (data.code !== "0") {
            throw new Error(`Quote error: ${data.msg} (Code: ${data.code})`);
        }

        return data;
    } catch (error) {
        console.error("Quote failed:", error);
        throw error;
    }
}

export async function sendCrossChainSwap(amount, userAddress) {
    if (!apiKey || !secretKey || !apiPassphrase || !projectId) {
        throw new Error("Missing API credentials");
    }

    try {
        const formattedAmount = formatAmount(amount);

        const quoteParams = {
            fromChainId: "501",
            toChainId: "137",
            fromTokenAddress: NATIVE_SOL,
            toTokenAddress: ETH,
            amount: formattedAmount,
            slippage: "0.5",
            userWalletAddress: userAddress,
            priceImpactProtectionPercentage: "0.9",
            receiveAddress: "0x9163756d2a83a334de2cc0c3aa1df9a5fc21369d",
            sort: "1"
        };

        const timestamp = new Date().toISOString();
        const requestPath = "/api/v5/dex/cross-chain/build-tx";
        const queryString = "?" + new URLSearchParams(quoteParams).toString();

        const headers = {
            "Content-Type": "application/json",
            "OK-ACCESS-KEY": apiKey,
            "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
                cryptoJS.HmacSHA256(timestamp + "GET" + requestPath + queryString, secretKey)
            ),
            "OK-ACCESS-TIMESTAMP": timestamp,
            "OK-ACCESS-PASSPHRASE": apiPassphrase,
            "OK-ACCESS-PROJECT": projectId,
        };

        const response = await fetch(
            `https://www.okx.com${requestPath}${queryString}`,
            { method: "GET", headers }
        );

        const data = await response.json();
        if (data.code !== "0") {
            throw new Error(`API Error: ${data.msg}`);
        }

        return await executeTransaction(data.data[0]);
    } catch (error) {
        console.error("Cross-chain swap failed:", error);
        throw error;
    }
}

function formatAmount(amount) {
    if (!amount) throw new Error("Amount is required");
    const numStr = amount.toString().replace(/[^\d.]/g, "");
    const wholePart = numStr.split(".")[0];
    return wholePart.replace(/^0+(?=\d)/, "") || "0";
}

export async function executeTransaction(txData) {
    if (!userPrivateKey) {
        throw new Error("Private key not found");
    }

    try {
        console.log("Received txData:", txData);

        // Check data structure
        if (!txData || (!txData.tx && !txData.data)) {
            console.error("Invalid txData structure:", txData);
            throw new Error("Invalid txData structure");
        }

        const transactionData = txData.tx?.data || txData.data;
        console.log("Transaction data found:", transactionData);

        if (!transactionData) {
            console.error("Missing transaction data in structure:", txData);
            throw new Error("Missing transaction data");
        }

        if (typeof transactionData !== 'string') {
            console.error("Transaction data is not a string:", typeof transactionData);
            throw new Error("Transaction data must be a string");
        }

        // Get fresh blockhash
        const recentBlockHash = await connection.getLatestBlockhash();
        console.log("Got blockhash:", recentBlockHash.blockhash);

        try {
            console.log("Attempting to decode transaction data:", transactionData);
            const decodedTransaction = base58.decode(transactionData);
            console.log("Decoded transaction successfully");

            let tx;
            try {
                tx = solanaWeb3.VersionedTransaction.deserialize(decodedTransaction);
                console.log("Successfully created versioned transaction");
                tx.message.recentBlockhash = recentBlockHash.blockhash;
            } catch (e) {
                console.log("Versioned transaction failed, trying legacy:", e);
                tx = solanaWeb3.Transaction.from(decodedTransaction);
                console.log("Successfully created legacy transaction");
                tx.recentBlockhash = recentBlockHash.blockhash;
            }

            const feePayer = solanaWeb3.Keypair.fromSecretKey(
                base58.decode(userPrivateKey)
            );
            console.log("Created feePayer keypair");

            if (tx instanceof solanaWeb3.VersionedTransaction) {
                tx.sign([feePayer]);
            } else {
                tx.partialSign(feePayer);
            }
            console.log("Transaction signed");

            const serialized = tx.serialize();
            console.log("Transaction serialized");

            const txId = await connection.sendRawTransaction(serialized, {
                skipPreflight: true,
            });
            console.log("Transaction sent, ID:", txId);

            const confirmation = await connection.confirmTransaction({
                signature: txId,
                blockhash: recentBlockHash.blockhash,
                lastValidBlockHeight: recentBlockHash.lastValidBlockHeight
            }, 'finalized');
            console.log("Transaction confirmed:", confirmation);

            return {
                success: true,
                transactionId: txId,
                explorerUrl: `https://solscan.io/tx/${txId}`,
                confirmation
            };
        } catch (decodeError) {
            console.error("Failed to decode/process transaction:", decodeError);
            console.error("Raw transaction data:", transactionData);
            throw new Error(`Transaction processing failed: ${decodeError.message}`);
        }
    } catch (error) {
        console.error("Transaction execution failed:", error);
        throw error;
    }
}


// Handle the quote and transaction building
export async function getSingleChainSwap(params) {
    if (!apiKey || !secretKey || !apiPassphrase || !projectId) {
        throw new Error("Missing API credentials");
    }

    try {
        const timestamp = new Date().toISOString();
        const requestPath = "/api/v5/dex/aggregator/swap";
        const queryString = "?" + new URLSearchParams(params).toString();

        const headers = {
            "Content-Type": "application/json",
            "OK-ACCESS-KEY": apiKey,
            "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
                cryptoJS.HmacSHA256(timestamp + "GET" + requestPath + queryString, secretKey)
            ),
            "OK-ACCESS-TIMESTAMP": timestamp,
            "OK-ACCESS-PASSPHRASE": apiPassphrase,
            "OK-ACCESS-PROJECT": projectId,
        };

        const response = await fetch(
            `https://www.okx.com${requestPath}${queryString}`,
            { method: "GET", headers }
        );

        const data = await response.json();
        if (data.code !== "0") {
            throw new Error(`API Error: ${data.msg}`);
        }

        return data.data[0];
    } catch (error) {
        console.error("Failed to get swap quote:", error);
        throw error;
    }
}

export async function executeSingleChainTransaction(txData) {
    if (!userPrivateKey) {
        throw new Error("Private key not found");
    }

    try {
        // Get fresh blockhash
        const recentBlockHash = await connection.getLatestBlockhash('processed');

        // Create and process transaction
        const decodedTransaction = base58.decode(txData.tx.data);
        const tx = solanaWeb3.Transaction.from(decodedTransaction);
        tx.recentBlockhash = recentBlockHash.blockhash;

        const feePayer = solanaWeb3.Keypair.fromSecretKey(
            base58.decode(userPrivateKey)
        );

        tx.partialSign(feePayer);

        // Send with retries if needed
        let txId;
        try {
            txId = await connection.sendRawTransaction(tx.serialize(), {
                skipPreflight: true,
                maxRetries: 3
            });
        } catch (sendError) {
            console.error("Failed to send transaction:", sendError);
            throw new Error("Failed to send transaction. Please try again.");
        }

        // Wait for confirmation with multiple attempts
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
                    // Check if transaction exists even if confirmation timed out
                    const status = await connection.getSignatureStatus(txId);
                    if (status?.value?.confirmationStatus) {
                        confirmation = { value: status.value };
                        break;
                    }
                    throw new Error("Transaction could not be confirmed. Please check explorer.");
                }
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