import base58 from "bs58";
const solanaWeb3 = require("@solana/web3.js");
const { Connection } = require("@solana/web3.js");
const cryptoJS = require("crypto-js");

// Use a reliable RPC endpoint
export const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=45f9798b-9483-4c10-87b6-47dcb952a345", {
    confirmTransactionInitialTimeout: 5000,
    wsEndpoint: "wss://mainnet.helius-rpc.com/?api-key=45f9798b-9483-4c10-87b6-47dcb952a345",
});

// Constants
export const NATIVE_SOL = "11111111111111111111111111111111";
export const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
export const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export const SOLANA_CHAIN_ID = "501";
const COMPUTE_UNITS = 300000;
const MAX_RETRIES = 3;

// Environment variables
const apiKey = process.env.REACT_APP_API_KEY;
const secretKey = process.env.REACT_APP_SECRET_KEY;
const apiPassphrase = process.env.REACT_APP_API_PASSPHRASE;
const projectId = process.env.REACT_APP_PROJECT_ID;
export const userPrivateKey = process.env.REACT_APP_PRIVATE_KEY;
export const userAddress = process.env.REACT_APP_USER_ADDRESS;
export const userEthAddress = process.env.REACT_APP_ETH_ADDRESS;

// Base headers function with validation
function getHeaders(timestamp, method, requestPath, queryString = "") {
    if (!apiKey || !secretKey || !apiPassphrase || !projectId) {
        throw new Error("Missing required environment variables");
    }

    const stringToSign = timestamp + method + requestPath + queryString;
    return {
        "Content-Type": "application/json",
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(stringToSign, secretKey)
        ),
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": apiPassphrase,
        "OK-ACCESS-PROJECT": projectId,
    };
}

// Helper function for amount formatting
function formatAmount(amount) {
    if (!amount) throw new Error("Amount is required");
    const numStr = amount.toString().replace(/[^\d.]/g, "");
    const wholePart = numStr.split(".")[0];
    return wholePart.replace(/^0+(?=\d)/, "") || "0";
}

// Regular DEX quote function
export async function getQuote(quoteParams) {
    if (!quoteParams.amount || !quoteParams.fromTokenAddress || !quoteParams.toTokenAddress) {
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
    const headers = getHeaders(timestamp, "GET", requestPath, "?" + queryString);

    try {
        const response = await fetch(
            `https://www.okx.com${requestPath}?${queryString}`,
            { method: "GET", headers }
        );

        if (!response.ok) {
            throw new Error(`Failed to get quote: ${await response.text()}`);
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
    const headers = getHeaders(timestamp, "GET", requestPath, "?" + queryString);

    try {
        const response = await fetch(
            `https://www.okx.com${requestPath}?${queryString}`,
            { method: "GET", headers }
        );

        if (!response.ok) {
            throw new Error(`Failed to get liquidity: ${await response.text()}`);
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

    return liquiditySources.find((source) => source.id === dexId.toString()) || null;
}

// Enhanced transaction execution with retries and compute budget
export async function executeTransaction(txData) {
    if (!userPrivateKey) {
        throw new Error("Private key not found");
    }

    let retryCount = 0;
    while (retryCount < MAX_RETRIES) {
        try {
            console.log("Received txData:", txData);

            if (!txData || (!txData.tx && !txData.data)) {
                throw new Error("Invalid txData structure");
            }

            const transactionData = txData.tx?.data || txData.data;
            if (!transactionData || typeof transactionData !== 'string') {
                throw new Error("Invalid transaction data");
            }

            const recentBlockHash = await connection.getLatestBlockhash();
            console.log("Got blockhash:", recentBlockHash.blockhash);

            const decodedTransaction = base58.decode(transactionData);
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

            // Add compute budget instruction
            const computeBudgetIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({
                units: COMPUTE_UNITS
            });

            const feePayer = solanaWeb3.Keypair.fromSecretKey(
                base58.decode(userPrivateKey)
            );

            if (tx instanceof solanaWeb3.VersionedTransaction) {
                tx.sign([feePayer]);
            } else {
                tx.partialSign(feePayer);
            }

            const txId = await connection.sendRawTransaction(tx.serialize(), {
                skipPreflight: false,
                maxRetries: 5
            });

            // Wait for confirmation with better error handling
            const confirmation = await connection.confirmTransaction({
                signature: txId,
                blockhash: recentBlockHash.blockhash,
                lastValidBlockHeight: recentBlockHash.lastValidBlockHeight
            }, 'confirmed');

            if (confirmation?.value?.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            return {
                success: true,
                transactionId: txId,
                explorerUrl: `https://solscan.io/tx/${txId}`,
                confirmation
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

// Cross-chain swap functions
export async function getCrossChainQuote(params) {
    const quoteParams = {
        fromChainId: params.fromChainId,
        toChainId: params.toChainId,
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        amount: formatAmount(params.amount),
        slippage: params.slippage,
        priceImpactProtectionPercentage: params.priceImpactProtectionPercentage,
    };

    const timestamp = new Date().toISOString();
    const requestPath = "/api/v5/dex/cross-chain/quote";
    const queryString = new URLSearchParams(quoteParams).toString();
    const headers = getHeaders(timestamp, "GET", requestPath, "?" + queryString);

    const response = await fetch(
        `https://www.okx.com${requestPath}?${queryString}`,
        { method: "GET", headers }
    );

    const data = await response.json();
    if (data.code !== "0") {
        throw new Error(`Quote error: ${data.msg} (Code: ${data.code})`);
    }

    return data;
}

// Cross-chain swap functions
export async function getBuildTx(params) {
    const quoteParams = {
        fromChainId: params.fromChainId,
        toChainId: params.toChainId,
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        amount: formatAmount(params.amount),
        slippage: params.slippage,
        userWalletAddress: userAddress,
        priceImpactProtectionPercentage: params.priceImpactProtectionPercentage,
        receiveAddress: params.recieveAddress,
    };

    const timestamp = new Date().toISOString();
    const requestPath = "/api/v5/dex/cross-chain/build-tx";
    const queryString = new URLSearchParams(quoteParams).toString();
    const headers = getHeaders(timestamp, "GET", requestPath, "?" + queryString);

    const response = await fetch(
        `https://www.okx.com${requestPath}?${queryString}`,
        { method: "GET", headers }
    );

    const data = await response.json();
    if (data.code !== "0") {
        throw new Error(`Quote error: ${data.msg} (Code: ${data.code})`);
    }

    return data;
}

// Cross-chain swap execution
export async function sendCrossChainSwap(amount, userAddress) {
    if (!apiKey || !secretKey || !apiPassphrase || !projectId) {
        throw new Error("Missing API credentials");
    }

    const quoteParams = {
        fromChainId: "501",
        toChainId: "137",
        fromTokenAddress: NATIVE_SOL,
        toTokenAddress: ETH,
        amount: formatAmount(amount),
        slippage: "0.5",
        userWalletAddress: userAddress,
        priceImpactProtectionPercentage: "0.9",
        sort: "1",
        recieveAddress: userEthAddress,
    };

    const data = await getBuildTx(quoteParams);
    return await executeTransaction(data.data[0]);
}

// Enhanced single chain swap with better validation
export async function getSingleChainSwap(params) {
    if (!apiKey || !secretKey || !apiPassphrase || !projectId) {
        throw new Error("Missing API credentials");
    }

    const timestamp = new Date().toISOString();
    const requestPath = "/api/v5/dex/aggregator/swap";
    const queryString = "?" + new URLSearchParams(params).toString();
    const headers = getHeaders(timestamp, "GET", requestPath, queryString);

    console.log("Requesting swap quote with params:", params);

    const response = await fetch(
        `https://www.okx.com${requestPath}${queryString}`,
        { method: "GET", headers }
    );

    const data = await response.json();
    if (data.code !== "0") {
        throw new Error(`API Error: ${data.msg}`);
    }

    if (!data.data?.[0]?.routerResult?.toTokenAmount) {
        throw new Error("Invalid or missing output amount");
    }

    return data.data[0];
}

export async function executeSingleChainTransaction(txData) {
    return await executeTransaction(txData);
}