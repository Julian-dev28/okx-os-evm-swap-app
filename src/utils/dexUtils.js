import Web3 from "web3";
import cryptoJS from "crypto-js";

const avalancheCMainnet = "https://avalanche-c-chain-rpc.publicnode.com";
const okxDexAddress = "0x40aA958dd87FC8305b97f2BA922CDdCa374bcD7f";
const targetChainId = "43114";
const baseTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const wavaxTokenAddress = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";
const apiBaseUrl = "https://www.okx.com/api/v5/dex/aggregator";
const RandomAddress = "0xd37268a16374d0a52c801c06a11ef32a35fcd2b9"


// Environment variables
const web3 = new Web3(avalancheCMainnet);
export const chainId = targetChainId;
export const fromTokenAddress = wavaxTokenAddress;
export const toTokenAddress = baseTokenAddress;
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
    const chainTxInfo = await web3.eth.sendSignedTransaction(rawTransaction);
    console.log("chainTxInfo:", chainTxInfo);
    return chainTxInfo;
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
