import Web3 from "web3";
import cryptoJS from "crypto-js";

export const mantleMainnet = "https://rpc.mantle.xyz";
export const okxDexAddress = "0x57df6092665eb6058DE53939612413ff4B09114E";
export const fromChainId = "5000";
export const toChainId = "8453";
export const baseTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const wethTokenAddress = "0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111";

// Initialize Web3 instance with Avalanche RPC
const web3 = new Web3(mantleMainnet);
// Base URL for API requests
const apiBaseUrl = "https://www.okx.com/api/v5/dex/aggregator";

// Environment variables
export const chainId = fromChainId;
export const fromTokenAddress = baseTokenAddress;
export const toTokenAddress = wethTokenAddress;
export const ratio = BigInt(3) / BigInt(2);
export const user = process.env.REACT_APP_USER_ADDRESS;
export const privateKey = process.env.REACT_APP_PRIVATE_KEY;
export const spenderAddress = okxDexAddress;

const apiKey = process.env.REACT_APP_API_KEY;
const secretKey = process.env.REACT_APP_SECRET_KEY;
const apiPassphrase = process.env.REACT_APP_API_PASSPHRASE;
const projectId = process.env.REACT_APP_PROJECT_ID;

/**
 * Helper function for constructing API URLs
 * @param {string} methodName - API endpoint path
 * @param {Object} queryParams - URL parameters
 * @returns {string} Complete API URL
 */
export function getAggregatorRequestUrl(methodName, queryParams) {
    return (
        apiBaseUrl +
        methodName +
        "?" +
        new URLSearchParams(queryParams).toString()
    );
}

/**
 * Generates headers required for OKX DEX quote API calls
 * Headers include timestamp, signature, and API credentials
 *
 * @param {Object} quoteParams - Parameters for the quote request
 * @returns {Object} Headers object with required authentication
 */
export function getQuoteHeaders(quoteParams) {
    const date = new Date();
    const timestamp = date.toISOString();
    const stringToSign =
        timestamp +
        "GET" +
        "/api/v5/dex/aggregator/quote?" +
        new URLSearchParams(quoteParams).toString();

    return {
        "Content-Type": "application/json",
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(stringToSign, secretKey),
        ),
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": apiPassphrase,
    };
}

/**
 * Fetches a quote from the OKX DEX Aggregator
 * Used to get current prices and optimal swap routes
 *
 * @param {Object} quoteParams - Parameters including tokens, amount, and chain
 * @returns {Promise<Object>} Quote data including price and route information
 */
export async function getQuote(quoteParams) {
    const apiRequestUrl = getAggregatorRequestUrl("/quote", quoteParams);
    const headersParams = getQuoteHeaders(quoteParams);

    const response = await fetch(apiRequestUrl, {
        method: "GET",
        headers: headersParams,
    });

    if (!response.ok) {
        throw new Error("Network response was not ok");
    }

    return response.json();
}

// ABI for ERC20 token allowance function
// This minimal ABI only includes the allowance function needed for checking token approvals
// Full ERC20 ABI not needed since we're only checking allowances
const tokenABI = [
    {
        constant: true,
        inputs: [
            {
                name: "_owner",
                type: "address",
            },
            {
                name: "_spender",
                type: "address",
            },
        ],
        name: "allowance",
        outputs: [
            {
                name: "",
                type: "uint256",
            },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
];

/**
 * Checks the current allowance for a token
 * Used to determine if approval is needed before swap
 *
 * @param {string} ownerAddress - Address of token owner
 * @param {string} spenderAddress - Address of spender (DEX contract)
 * @param {string} tokenAddress - Address of token contract
 * @returns {Promise<number>} Current allowance amount
 */
export async function getAllowance(ownerAddress, spenderAddress, tokenAddress) {
    const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
    try {
        const allowance = await tokenContract.methods
            .allowance(ownerAddress, spenderAddress)
            .call();
        return parseFloat(allowance);
    } catch (error) {
        console.error("Failed to query allowance:", error);
        throw error;
    }
}

/**
 * Generates headers required for OKX DEX approve transaction API calls
 * Headers include timestamp, signature, and API credentials
 *
 * @param {Object} params - Parameters for the approve transaction
 * @returns {Promise<Object>} Headers object with required authentication
 */
export function getApproveTransactionHeaders(params) {
    const date = new Date();
    const timestamp = date.toISOString();
    const stringToSign =
        timestamp +
        "GET" +
        "/api/v5/dex/aggregator/approve-transaction?" +
        new URLSearchParams(params).toString();

    // Check if required environment variables are present
    if (!projectId || !apiKey || !secretKey || !apiPassphrase) {
        throw new Error(
            "Missing required environment variables for API authentication",
        );
    }

    return {
        "Content-Type": "application/json",
        "OK-PROJECT-ID": projectId,
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(stringToSign, secretKey),
        ),
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": apiPassphrase,
    };
}

/**
 * Gets approval transaction data from the API
 *
 * @param {string} chainId - Network chain ID
 * @param {string} tokenContractAddress - Token to approve
 * @param {string} approveAmount - Amount to approve
 * @returns {Promise<Object>} Approval transaction data
 */
export async function approveTransaction(
    chainId,
    tokenContractAddress,
    approveAmount,
) {
    if (!chainId || !tokenContractAddress || !approveAmount) {
        throw new Error("Missing required parameters for approval");
    }

    const params = { chainId, tokenContractAddress, approveAmount };
    const apiRequestUrl = getAggregatorRequestUrl(
        "/approve-transaction",
        params,
    );
    const headersParams = getApproveTransactionHeaders(params);

    try {
        const response = await fetch(apiRequestUrl, {
            method: "GET",
            headers: headersParams,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(
                `API request failed: ${response.status} ${response.statusText}${errorData ? ` - ${JSON.stringify(errorData)}` : ""
                }`,
            );
        }

        const data = await response.json();

        // Validate the response data
        if (
            !data ||
            !data.data ||
            !Array.isArray(data.data) ||
            data.data.length === 0
        ) {
            throw new Error("Invalid response format from approval API");
        }

        return data;
    } catch (error) {
        console.error("Approval request failed:", error);
        throw error;
    }
}

/**
 * Handles the approval transaction if needed
 * Checks current allowance and submits approval transaction if necessary
 *
 * @param {string} approveAmount - Amount to approve for spending
 * @returns {Promise<Object|null>} Transaction receipt or null if approval not needed
 */
export async function sendApproveTx(approveAmount) {
    // First check if it's ETH/WETH
    if (
        fromTokenAddress.toLowerCase() ===
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase()
    ) {
        return null; // No approval needed for ETH
    }

    const allowanceAmount = await getAllowance(
        user,
        spenderAddress,
        wethTokenAddress,
    );

    if (BigInt(allowanceAmount) < BigInt(approveAmount)) {
        let gasPrice = await web3.eth.getGasPrice();
        let nonce = await web3.eth.getTransactionCount(user);

        try {
            const approvalResult = await approveTransaction(
                chainId,
                fromTokenAddress,
                approveAmount,
            );

            // Add error checking for the approval result
            if (!approvalResult.data || !approvalResult.data[0]) {
                throw new Error("Invalid approval data received");
            }

            const { data } = approvalResult;

            const txObject = {
                nonce: nonce,
                to: fromTokenAddress,
                gasLimit: BigInt(data[0].gasLimit) * BigInt(2),
                gasPrice: (BigInt(gasPrice) * BigInt(3)) / BigInt(2),
                data: data[0].data,
                value: "0",
            };

            const { rawTransaction } = await web3.eth.accounts.signTransaction(
                txObject,
                privateKey,
            );

            return web3.eth.sendSignedTransaction(rawTransaction);
        } catch (error) {
            console.error("Approval transaction failed:", error);
            throw new Error(`Approval failed: ${error.message}`);
        }
    } else {
        return null; // Sufficient allowance exists
    }
}

/**
 * Helper function to get headers for swap API calls
 * @param {Object} swapParams - Swap parameters
 * @returns {Object} Headers with authentication
 */
export function getSwapHeaders(swapParams) {
    const date = new Date();
    const timestamp = date.toISOString();
    const stringToSign =
        timestamp +
        "GET" +
        "/api/v5/dex/aggregator/swap?" +
        new URLSearchParams(swapParams).toString();

    return {
        "Content-Type": "application/json",
        "OK-PROJECT-ID": process.env.REACT_APP_PROJECT_ID,
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(stringToSign, secretKey),
        ),
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": apiPassphrase,
    };
}

/**
 * Helper function to get swap data from API
 * @param {Object} swapParams - Swap parameters
 * @returns {Promise<Object>} Swap transaction data
 */
export const getSwapData = async (swapParams) => {
    const apiRequestUrl = getAggregatorRequestUrl("/swap", swapParams);
    const headersParams = getSwapHeaders(swapParams);

    const response = await fetch(apiRequestUrl, {
        method: "GET",
        headers: headersParams,
    });

    if (!response.ok) {
        throw new Error("Network response was not ok");
    }

    return response.json();
};

/**
 * Executes a single-chain token swap
 * Handles the main swap transaction after approval
 *
 * @param {Object} swapParams - Parameters for the swap
 * @returns {Promise<Object>} Transaction receipt
 */
export async function sendSwapTx(swapParams) {
    const { data: swapData } = await getSwapData(swapParams);
    console.log("swapData:", swapData);

    if (!swapData || swapData.length === 0 || !swapData[0].tx) {
        throw new Error("Invalid swap data received");
    }

    const swapDataTxInfo = swapData[0].tx;
    const nonce = await web3.eth.getTransactionCount(user, "latest");

    // Log the transaction parameters
    console.log("Transaction parameters:", {
        data: swapDataTxInfo.data,
        gasPrice: BigInt(swapDataTxInfo.gasPrice) * BigInt(ratio),
        to: swapDataTxInfo.to,
        value: swapDataTxInfo.value,
        gas: BigInt(swapDataTxInfo.gas) * BigInt(ratio),
        nonce,
    });

    let signTransactionParams = {
        data: swapDataTxInfo.data,
        gasPrice: BigInt(swapDataTxInfo.gasPrice) * BigInt(ratio),
        to: swapDataTxInfo.to,
        value: swapDataTxInfo.value,
        gas: BigInt(swapDataTxInfo.gas) * BigInt(ratio),
        nonce,
    };

    const { rawTransaction } = await web3.eth.accounts.signTransaction(
        signTransactionParams,
        privateKey,
    );
    return web3.eth.sendSignedTransaction(rawTransaction);
}

/**
 * Signs and sends a transaction to the network
 *
 * @param {Object} txObject - Transaction parameters
 * @returns {Promise<Object>} Transaction receipt
 */
export async function sendSignedTransaction(txObject) {
    const { rawTransaction } = await web3.eth.accounts.signTransaction(
        txObject,
        privateKey,
    );
    const result = await web3.eth.sendSignedTransaction(rawTransaction);
    return result;
}

/**
 * Helper function to get headers for cross-chain quote API calls
 * @param {Object} params - Quote parameters
 * @returns {Object} Headers with authentication
 */
export function getCrossChainQuoteHeaders(params) {
    const date = new Date();
    const timestamp = date.toISOString();
    const stringToSign =
        timestamp +
        "GET" +
        "/api/v5/dex/cross-chain/quote?" +
        new URLSearchParams(params).toString();

    return {
        "Content-Type": "application/json",
        "OK-PROJECT-ID": projectId,
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(stringToSign, secretKey),
        ),
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": apiPassphrase,
    };
}

/**
 * Gets a quote for cross-chain swaps
 * Used to estimate costs and routes across different networks
 *
 * @param {string} amount - Amount to swap
 * @returns {Promise<Object>} Quote data for cross-chain swap
 */
export async function getCrossChainQuote(amount) {
    const quoteParams = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: baseTokenAddress,
        toTokenAddress: baseTokenAddress,
        receiveAddress: user,
        amount: amount,
        slippage: "0.5",
        userWalletAddress: user,
        sort: 0,
        priceImpactProtectionPercentage: "1.0",
    };

    const apiRequestUrl =
        "https://www.okx.com/api/v5/dex/cross-chain/quote?" +
        new URLSearchParams(quoteParams).toString();
    const headersParams = getCrossChainQuoteHeaders(quoteParams);

    const response = await fetch(apiRequestUrl, {
        method: "GET",
        headers: headersParams,
    });

    console.log("response:", response);

    if (!response.ok) {
        throw new Error("Network response was not ok");
    }

    return response.json();
}

/**
 * Helper function to get headers for cross-chain swap API calls
 * @param {Object} params - Swap parameters
 * @returns {Object} Headers with authentication
 */
export function getCrossChainQuoteSwapHeaders(params) {
    const date = new Date();
    const timestamp = date.toISOString();
    const stringToSign =
        timestamp +
        "GET" +
        "/api/v5/dex/cross-chain/build-tx?" +
        new URLSearchParams(params).toString();

    return {
        "Content-Type": "application/json",
        "OK-PROJECT-ID": projectId,
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(stringToSign, secretKey),
        ),
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": apiPassphrase,
    };
}

/**
 * Executes a cross-chain swap transaction
 * Handles the complete cross-chain swap process
 *
 * @param {string} amount - Amount to swap
 * @returns {Promise<Object>} Transaction receipt
 */
export async function sendCrossChainSwap(amount) {
    const quoteParams = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: baseTokenAddress,
        toTokenAddress: baseTokenAddress,
        receiveAddress: user,
        amount: amount,
        slippage: "0.5",
        userWalletAddress: user,
        sort: 0,
        priceImpactProtectionPercentage: "1.0",
    };

    try {
        // Make the direct API call for the swap data
        const apiRequestUrl =
            "https://www.okx.com/api/v5/dex/cross-chain/build-tx?" +
            new URLSearchParams(quoteParams).toString();
        const headersParams = getCrossChainQuoteSwapHeaders(quoteParams);

        const response = await fetch(apiRequestUrl, {
            method: "GET",
            headers: headersParams,
        });

        const swapData = await response.json();

        // Validate the response data
        if (
            !swapData ||
            !swapData.data ||
            !swapData.data[0] ||
            !swapData.data[0].tx
        ) {
            throw new Error(
                "Invalid swap data received: " + JSON.stringify(swapData),
            );
        }

        const swapDataTxInfo = swapData.data[0].tx;
        const nonce = await web3.eth.getTransactionCount(user, "latest");

        // Prepare transaction parameters
        let signTransactionParams = {
            from: user,
            data: swapDataTxInfo.data,
            to: swapDataTxInfo.to,
            value: swapDataTxInfo.value,
            nonce,
            // Use gas parameters from the API response
            gasPrice: swapDataTxInfo.gasPrice
                ? BigInt(swapDataTxInfo.gasPrice) * BigInt(ratio)
                : undefined,
            maxPriorityFeePerGas: swapDataTxInfo.maxPriorityFeePerGas
                ? BigInt(swapDataTxInfo.maxPriorityFeePerGas) * BigInt(ratio)
                : undefined,
            gas: swapDataTxInfo.gasLimit
                ? BigInt(swapDataTxInfo.gasLimit) * BigInt(ratio)
                : undefined,
        };

        // Handle any additional signature data if present
        if (swapDataTxInfo.signatureData) {
            signTransactionParams.signatureData = swapDataTxInfo.signatureData;
        }

        // Sign and send the transaction
        const { rawTransaction } = await web3.eth.accounts.signTransaction(
            signTransactionParams,
            privateKey,
        );

        return web3.eth.sendSignedTransaction(rawTransaction);
    } catch (error) {
        console.error("Cross-chain swap failed:", error);
        throw new Error(`Cross-chain swap failed: ${error.message}`);
    }
}
