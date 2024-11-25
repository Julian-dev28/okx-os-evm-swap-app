import base58 from "bs58"; // Changed import
const solanaWeb3 = require("@solana/web3.js");
const { Connection } = require("@solana/web3.js");
const cryptoJS = require("crypto-js");

// Use a reliable RPC endpoint
// const SOLANA_RPC_ENDPOINT =
//     "https://solana-mainnet.g.alchemy.com/v2/hWHVoXxpR4XpLbjTf4cOKfEwXdgGlc7R";
// // Or use one of these alternatives:
// // const SOLANA_RPC_ENDPOINT = "https://solana-api.projectserum.com";
// // const SOLANA_RPC_ENDPOINT = clusterApiUrl('mainnet-beta');

// // Connection configuration with proper options
// const connection = new Connection(SOLANA_RPC_ENDPOINT, {
//     commitment: "confirmed",
//     confirmTransactionInitialTimeout: 30000,
//     wsEndpoint: undefined, // Disable WebSocket
//     disableRetryOnRateLimit: false,
//     httpHeaders: {
//         "Content-Type": "application/json",
//         "X-API-Key": "hWHVoXxpR4XpLbjTf4cOKfEwXdgGlc7R",
//     },
// });

const connection = new Connection("https://api.mainnet-beta.solana.com");
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
    const requestPath = "/api/v5/dex/cross-chain/quote";
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
        console.error("API credentials check:", {
            hasApiKey: !!apiKey,
            hasSecretKey: !!secretKey,
            hasPassphrase: !!apiPassphrase,
            hasProjectId: !!projectId,
        });
        throw new Error("Missing API credentials");
    }

    try {
        // Validate and format amount
        if (!amount) throw new Error("Amount is required");
        console.log("Original amount:", amount);
        const formattedAmount = formatAmount(amount);
        console.log("Formatted amount:", formattedAmount);

        // Basic parameters
        const quoteParams = {
            fromChainId: "501",
            toChainId: "137",
            fromTokenAddress: NATIVE_SOL,
            toTokenAddress: ETH,
            amount: formattedAmount,
            slippage: ".5",
            userWalletAddress: userAddress,
            priceImpactProtectionPercentage: "1",
            receiveAddress: "0x85032bb06a9e5c96e3a1bb5e2475719fd6d4796e",
            sort: "0",
        };

        function generateHeaders(method, requestPath, queryString = "") {
            const timestamp = new Date().toISOString();
            // Remove the '?' if it exists at the start of queryString
            const cleanQueryString = queryString.startsWith("?")
                ? queryString.substring(1)
                : queryString;
            // Construct the sign string with the full path first
            const signString =
                timestamp +
                method +
                requestPath +
                (cleanQueryString ? "?" + cleanQueryString : "");

            console.log("Auth details:", {
                timestamp,
                method,
                path: requestPath,
                query: cleanQueryString,
                signString,
            });

            const sign = cryptoJS
                .HmacSHA256(signString, secretKey)
                .toString(cryptoJS.enc.Base64);

            return {
                "Content-Type": "application/json",
                "OK-ACCESS-KEY": apiKey,
                "OK-ACCESS-SIGN": sign,
                "OK-ACCESS-TIMESTAMP": timestamp,
                "OK-ACCESS-PASSPHRASE": apiPassphrase,
                "OK-ACCESS-PROJECT": projectId,
            };
        }
        // Quote request
        const quoteRequestPath = "/api/v5/dex/cross-chain/build-tx";
        const quoteQueryString =
            "?" + new URLSearchParams(quoteParams).toString();
        const quoteHeaders = generateHeaders(
            "GET",
            quoteRequestPath,
            quoteQueryString,
        );

        console.log("Making quote request...");
        const quoteResponse = await fetch(
            `https://www.okx.com${quoteRequestPath}${quoteQueryString}`,
            {
                method: "GET",
                headers: quoteHeaders,
            },
        );

        // Log response details
        console.log("Quote response status:", quoteResponse.status);
        const responseHeaders = {};
        quoteResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });
        console.log("Quote response headers:", responseHeaders);

        const quoteText = await quoteResponse.text();
        console.log("Quote response text:", quoteText);

        // Parse response
        let quoteData;
        try {
            quoteData = JSON.parse(quoteText);
        } catch (e) {
            console.error("Failed to parse quote response:", e);
            throw new Error("Invalid response format");
        }

        // Check response
        if (quoteData.code !== "0") {
            console.error("Quote error details:", quoteData);
            throw new Error(
                `Quote failed: ${quoteData.msg || "Unknown error"} (Code: ${quoteData.code})`,
            );
        }

        // Change this check - the structure is different for cross-chain
        if (!quoteData.data?.[0]?.router) {
            // Changed from routerList to router
            throw new Error("No valid routes found");
        }

        // Selected route - remove the routerList[0] access
        const selectedRouter = quoteData.data[0].router; // Changed this line
        console.log("Selected router:", selectedRouter);

        // Build transaction parameters
        const buildTxParams = {
            ...quoteParams,
            receiveAddress: "0x85032bb06a9e5c96e3a1bb5e2475719fd6d4796e",
            routerId: selectedRouter.bridgeId, // Changed from routerId to bridgeId
            bridgeId: selectedRouter.bridgeId,
            router: selectedRouter.bridgeName, // Changed from router to bridgeName
            sort: "0",
        };

        // Build TX request
        const buildTxRequestPath = "/api/v5/dex/cross-chain/build-tx";
        const buildTxQueryString =
            "?" + new URLSearchParams(buildTxParams).toString();
        const buildTxHeaders = generateHeaders(
            "GET",
            buildTxRequestPath,
            buildTxQueryString,
        );

        console.log("Making build-tx request...");
        const buildTxResponse = await fetch(
            `https://www.okx.com${buildTxRequestPath}${buildTxQueryString}`,
            {
                method: "GET",
                headers: buildTxHeaders,
            },
        );

        const buildTxText = await buildTxResponse.text();
        console.log("Build TX response:", buildTxText);

        const buildTxData = JSON.parse(buildTxText);
        if (buildTxData.code !== "0") {
            throw new Error(
                `API Error: ${buildTxData.msg || ""} (Code: ${buildTxData.code})`,
            );
        }

        // Execute transaction
        return await executeTransaction(buildTxData.data[0]);
    } catch (error) {
        console.error("Cross-chain swap failed:", error);
        throw error;
    }
}

// Updated amount formatting function
function formatAmount(amount) {
    try {
        // Convert to string and handle scientific notation
        const num = typeof amount === "string" ? amount : amount.toString();

        // Remove any non-numeric characters except decimal point
        const cleaned = num.replace(/[^\d.]/g, "");

        // Split on decimal and take whole part
        const wholePart = cleaned.split(".")[0];

        // Remove leading zeros but keep single zero
        const formatted = wholePart.replace(/^0+(?=\d)/, "") || "0";

        console.log("Amount formatting steps:", {
            input: amount,
            cleaned: cleaned,
            formatted: formatted,
        });

        return formatted;
    } catch (err) {
        console.error("Amount formatting error:", err);
        throw new Error(`Invalid amount format: ${amount}`);
    }
}

export async function executeTransaction(txData) {
    if (!userPrivateKey) {
        throw new Error("Private key not found");
    }

    // Add RPC fallback options
    const rpcEndpoints = [
        connection, // your primary connection
        new solanaWeb3.Connection("https://api.mainnet-beta.solana.com"), // fallback public RPC
        // Add more fallback RPCs as needed
    ];

    let currentRPC = 0;
    let recentBlockHash;

    // Try getting blockhash from different RPCs
    while (currentRPC < rpcEndpoints.length) {
        try {
            recentBlockHash =
                await rpcEndpoints[currentRPC].getLatestBlockhash();
            break;
        } catch (error) {
            console.warn(`RPC ${currentRPC} failed:`, error);
            currentRPC++;
            if (currentRPC >= rpcEndpoints.length) {
                throw new Error(
                    "All RPC endpoints failed to get recent blockhash",
                );
            }
        }
    }
    console.log({ blockHash: recentBlockHash });

    try {
        const transaction = base58.decode(txData.tx.data);
        let tx;

        try {
            tx = solanaWeb3.Transaction.from(transaction);
            console.log("Created legacy transaction");
        } catch (error) {
            tx = solanaWeb3.VersionedTransaction.deserialize(transaction);
            console.log("Created versioned transaction");
        }

        // Use the successful RPC connection
        const connection = rpcEndpoints[currentRPC];

        if (tx instanceof solanaWeb3.VersionedTransaction) {
            tx.message.recentBlockhash = recentBlockHash.blockhash;
        } else {
            tx.recentBlockhash = recentBlockHash.blockhash;
        }

        const feePayer = solanaWeb3.Keypair.fromSecretKey(
            base58.decode(userPrivateKey),
        );

        if (txData.tx.randomKeyAccount?.length > 0) {
            console.log("Multi-signature transaction detected");
        }

        if (tx instanceof solanaWeb3.VersionedTransaction) {
            tx.sign([feePayer]);
        } else {
            tx.partialSign(feePayer);
        }

        console.log("Transaction signed, sending...");
        const txId = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        });

        console.log("Transaction sent:", txId);
        const confirmation = await connection.confirmTransaction(txId);

        return {
            success: true,
            transactionId: txId,
            explorerUrl: `https://solscan.io/tx/${txId}`,
            confirmation,
            bridgeInfo: txData.router
                ? {
                      id: txData.router.bridgeId,
                      name: txData.router.bridgeName,
                      fee: txData.router.crossChainFee,
                      nativeFee: txData.router.otherNativeFee,
                  }
                : null,
        };
    } catch (error) {
        console.error("Transaction execution failed:", error);
        throw error;
    }
}
