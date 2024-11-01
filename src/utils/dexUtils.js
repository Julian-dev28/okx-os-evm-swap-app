import Web3 from "web3";
import cryptoJS from "crypto-js";

const lineaMainnet = "https://linea.blockpi.network/v1/rpc/public";
const ethMainnet =
    "https://eth-mainnet.g.alchemy.com/v2/I177iatNveGoBt3geurbwflbKjKh8bzq";
const ethSepolia =
    "https://eth-sepolia.g.alchemy.com/v2/I177iatNveGoBt3geurbwflbKjKh8bzq";
const xlayerMainnet = "https://endpoints.omniatech.io/v1/xlayer/mainnet/public";
const xlayerTestnet = "https://endpoints.omniatech.io/v1/xlayer/testnet/public";
const foxyTokenAddress = "0x5FBDF89403270a1846F5ae7D113A989F850d1566";
const ethUSDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ethSepoliaUSDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const xlayerUSDC = "0x74b7f16337b8972027f6196a17a631ac6de26d22";
const xlayerTestnetUSDC = "0xea1d4778068089dd021859da423f5ed95efc7cdc";
const demoAddress = "0x40aa958dd87fc8305b97f2ba922cddca374bcd7f";
const baseTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const personalAddress = "0xd37268a16374d0a52c801c06a11ef32a35fcd2b9"; // Change to your personal address
const okxDexAddress = "0x8b773D83bc66Be128c60e07E17C8901f7a64F000";
const okxDexLinea = "0x57df6092665eb6058DE53939612413ff4B09114E";
const ethChainId = "1";
const ethSepoliaChainId = "11155111";
const xlayerChainId = "196";
const xlayerTestnetChainId = "195";
const lineaChainId = "59144";

const apiBaseUrl = "https://www.okx.com/api/v5/dex/aggregator";

// Environment variables
// XLayer: 196 | XLayer Testnet: 195 | ETH Mainnet: 1 | ETH Sepolia: 11155111

const web3 = new Web3(lineaMainnet);
export const chainId = lineaChainId;
export const toTokenAddress = baseTokenAddress;
export const fromTokenAddress = foxyTokenAddress;
export const ratio = BigInt(3) / BigInt(2);
export const user = process.env.REACT_APP_USER_ADDRESS;
export const fromAmount = "10";
export const privateKey = process.env.REACT_APP_PRIVATE_KEY;
export const spenderAddress = okxDexLinea;

const apiKey = process.env.REACT_APP_API_KEY;
const secretKey = process.env.REACT_APP_SECRET_KEY;
const apiPassphrase = process.env.REACT_APP_API_PASSPHRASE;

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

export async function approveTransaction(
    chainId,
    tokenContractAddress,
    approveAmount,
) {
    const params = { chainId, tokenContractAddress, approveAmount };
    const apiRequestUrl = getAggregatorRequestUrl(
        "/approve-transaction",
        params,
    );
    const headersParams = getApproveTransactionHeaders(params);

    const response = await fetch(apiRequestUrl, {
        method: "GET",
        headers: headersParams,
    });

    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    return response.json();
}
export async function sendApproveTx(approveAmount) {
    const allowanceAmount = await getAllowance(
        user,
        spenderAddress,
        fromTokenAddress,
    );
    if (BigInt(allowanceAmount) < BigInt(approveAmount)) {
        let gasPrice = await web3.eth.getGasPrice();
        let nonce = await web3.eth.getTransactionCount(user);
        const { data } = await approveTransaction(
            chainId,
            fromTokenAddress,
            approveAmount,
        );

        const txObject = {
            nonce: nonce,
            to: fromTokenAddress, // approve token address
            gasLimit: BigInt(data[0].gasLimit) * BigInt(2), // avoid GasLimit too low
            gasPrice: (BigInt(gasPrice) * BigInt(3)) / BigInt(2), // avoid GasPrice too low
            data: data[0].data, // approve callData
            value: "0", // approve value fix 0 since user is not sending any ETH or token
        };
        const { rawTransaction } = await web3.eth.accounts.signTransaction(
            txObject,
            privateKey,
        );
        return web3.eth.sendSignedTransaction(rawTransaction);
    } else {
        return null; // No approval needed
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
