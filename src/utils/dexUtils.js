import Web3 from "web3";
import cryptoJS from "crypto-js";

const avalancheCMainnet = "https://avalanche-c-chain-rpc.publicnode.com";
const okxDexAddress = "0x1daC23e41Fc8ce857E86fD8C1AE5b6121C67D96d";
const targetChainId = "43114";
export const baseTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const wavaxTokenAddress = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";
const apiBaseUrl = "https://www.okx.com/api/v5/dex/aggregator";
const RandomAddress = "0x85032bb06a9e5c96e3a1bb5e2475719fd6d4796e"


// Environment variables
const web3 = new Web3(avalancheCMainnet);
export const chainId = targetChainId;
export const fromTokenAddress = baseTokenAddress;
export const toTokenAddress = wavaxTokenAddress;
export const ratio = BigInt(3) / BigInt(2);
export const user = process.env.REACT_APP_USER_ADDRESS;
export const privateKey = process.env.REACT_APP_PRIVATE_KEY;
export const spenderAddress = okxDexAddress;

const apiKey = process.env.REACT_APP_API_KEY;
const secretKey = process.env.REACT_APP_SECRET_KEY;
const apiPassphrase = process.env.REACT_APP_API_PASSPHRASE;
const projectId = process.env.REACT_APP_PROJECT_ID;

// Helper function
function getAggregatorRequestUrl(methodName, queryParams) {
    return (
        apiBaseUrl +
        methodName +
        "?" +
        new URLSearchParams(queryParams).toString()
    );
}

// Quote-related functions
function getQuoteHeaders(quoteParams) {
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

// Approve-related functions
function getApproveTransactionHeaders(params) {
    const date = new Date();
    const timestamp = date.toISOString();
    const stringToSign =
        timestamp +
        "GET" +
        "/api/v5/dex/aggregator/approve-transaction?" +
        new URLSearchParams(params).toString();

    // Check if required environment variables are present
    if (!projectId || !apiKey || !secretKey || !apiPassphrase) {
        throw new Error("Missing required environment variables for API authentication");
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
            throw new Error(`API request failed: ${response.status} ${response.statusText}${errorData ? ` - ${JSON.stringify(errorData)}` : ''
                }`);
        }

        const data = await response.json();

        // Validate the response data
        if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
            throw new Error("Invalid response format from approval API");
        }

        return data;
    } catch (error) {
        console.error("Approval request failed:", error);
        throw error;
    }
}

export async function sendApproveTx(approveAmount) {
    // First check if it's ETH/WAVAX
    if (fromTokenAddress.toLowerCase() === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase()) {
        return null; // No approval needed for ETH
    }

    const allowanceAmount = await getAllowance(
        user,
        spenderAddress,
        fromTokenAddress,
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

// Swap-related functions
function getSwapHeaders(swapParams) {
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
        nonce
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

// Transaction signing and sending
export async function sendSignedTransaction(txObject) {
    const { rawTransaction } = await web3.eth.accounts.signTransaction(
        txObject,
        privateKey,
    );
    const result = await web3.eth.sendSignedTransaction(rawTransaction);
    return result;
}

// Cross-chain quote-related functions
function getCrossChainQuoteHeaders(params) {
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

export async function getCrossChainQuote(amount) {
    const quoteParams = {
        fromChainId: targetChainId,  // Avalanche C-Chain
        toChainId: 59144,    // 
        fromTokenAddress: baseTokenAddress, // Native AVAX
        toTokenAddress: baseTokenAddress,   // Native ETH 
        amount: amount,
        slippage: "0.01",      // 1% slippage
    };

    const apiRequestUrl = "https://www.okx.com/api/v5/dex/cross-chain/quote?" + new URLSearchParams(quoteParams).toString();
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

function getCrossChainQuoteSwapHeaders(params) {
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

export async function sendCrossChainSwap(amount) {
    const quoteParams = {
        fromChainId: targetChainId,
        toChainId: 59144,
        fromTokenAddress: baseTokenAddress,
        toTokenAddress: baseTokenAddress,
        amount: amount,
        slippage: "0.01",
        userWalletAddress: user,
        sort: 0,
    };

    try {
        // Make the direct API call for the swap data
        const apiRequestUrl = "https://www.okx.com/api/v5/dex/cross-chain/build-tx?" +
            new URLSearchParams(quoteParams).toString();
        const headersParams = getCrossChainQuoteSwapHeaders(quoteParams);

        const response = await fetch(apiRequestUrl, {
            method: "GET",
            headers: headersParams,
        });

        const swapData = await response.json();

        // Validate the response data
        if (!swapData || !swapData.data || !swapData.data[0] || !swapData.data[0].tx) {
            throw new Error("Invalid swap data received: " + JSON.stringify(swapData));
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
            gasPrice: swapDataTxInfo.gasPrice ?
                BigInt(swapDataTxInfo.gasPrice) * BigInt(ratio) :
                undefined,
            maxPriorityFeePerGas: swapDataTxInfo.maxPriorityFeePerGas ?
                BigInt(swapDataTxInfo.maxPriorityFeePerGas) * BigInt(ratio) :
                undefined,
            gas: swapDataTxInfo.gasLimit ?
                BigInt(swapDataTxInfo.gasLimit) * BigInt(ratio) :
                undefined
        };

        // Handle any additional signature data if present
        if (swapDataTxInfo.signatureData) {
            signTransactionParams.signatureData = swapDataTxInfo.signatureData;
        }

        // Sign and send the transaction
        const { rawTransaction } = await web3.eth.accounts.signTransaction(
            signTransactionParams,
            privateKey
        );

        return web3.eth.sendSignedTransaction(rawTransaction);
    } catch (error) {
        console.error("Cross-chain swap failed:", error);
        throw new Error(`Cross-chain swap failed: ${error.message}`);
    }
}
