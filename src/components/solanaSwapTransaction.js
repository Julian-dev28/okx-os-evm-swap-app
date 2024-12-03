import React, { useState, useCallback } from "react";
import BN from "bn.js";
import {
    getSingleChainSwap,
    userAddress,
    SOLANA_CHAIN_ID,
    NATIVE_SOL,
    WRAPPED_SOL,
    USDC_SOL,
    executeSingleChainTransaction,
    userPrivateKey,
} from "../utils/dexUtils";

const SolanaSwapTransaction = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [txHash, setTxHash] = useState(null);
    const [amount, setAmount] = useState("");
    const [toToken, setToToken] = useState(WRAPPED_SOL);

    // Convert SOL to lamports
    const convertToLamports = useCallback((solAmount) => {
        try {
            if (!solAmount || isNaN(solAmount)) {
                throw new Error("Invalid amount");
            }
            const sol = parseFloat(solAmount);
            if (sol <= 0) {
                throw new Error("Amount must be greater than 0");
            }
            const lamports = new BN(sol * 1e9);
            return lamports.toString();
        } catch (err) {
            console.error("Amount conversion error:", err);
            throw new Error("Invalid amount format");
        }
    }, []);

    const handleAmountChange = (e) => {
        setAmount(e.target.value);
        setError(null);
    };

    const handleTokenChange = (e) => {
        setToToken(e.target.value);
        setError(null);
    };
    // Update your component's handleSwap function
    const handleSwap = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!userPrivateKey) {
                throw new Error("Private key not found");
            }

            const lamports = convertToLamports(amount);
            console.log("Amount in lamports:", lamports);

            // Get swap quote
            const quoteParams = {
                chainId: SOLANA_CHAIN_ID,
                amount: lamports,
                fromTokenAddress: NATIVE_SOL,
                toTokenAddress: toToken,
                slippage: "0.5",
                userWalletAddress: userAddress,
            };

            const swapData = await getSingleChainSwap(quoteParams);
            console.log("Swap data:", swapData);

            // Execute the swap
            const swapResult = await executeSingleChainTransaction(swapData);
            console.log("Swap result:", swapResult);

            setTxHash(swapResult.transactionId);
            setResult({
                inputAmount: amount,
                outputAmount: (parseFloat(swapData.toTokenAmount) / 1e9).toFixed(6),
                txHash: swapResult.transactionId,
                explorerUrl: swapResult.explorerUrl,
                confirmation: swapResult.confirmation,
            });
        } catch (error) {
            console.error("Swap failed:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="swap-container">
            <h2>Solana Token Swap</h2>

            <div className="input-container">
                <label>From (SOL):</label>
                <input
                    type="number"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="Enter amount in SOL"
                    step="0.000000001"
                    min="0"
                    className="swap-input"
                />
            </div>

            <div className="input-container">
                <label>To Token:</label>
                <select
                    value={toToken}
                    onChange={handleTokenChange}
                    className="token-select"
                >
                    <option value={WRAPPED_SOL}>Wrapped SOL</option>
                    <option value={USDC_SOL}>USDC</option>
                </select>
            </div>

            {loading ? (
                <p className="loading-message">Processing swap...</p>
            ) : error ? (
                <p className="error-message">Error: {error}</p>
            ) : (
                <>
                    <button
                        onClick={handleSwap}
                        className="swap-button"
                        disabled={!amount || loading}
                    >
                        Swap
                    </button>

                    {result && (
                        <div className="swap-result">
                            <h3>Swap Result</h3>
                            <div className="result-details">
                                <p>Input: {result.inputAmount} SOL</p>
                                <p>
                                    Output: {result.outputAmount}{" "}
                                    {toToken === WRAPPED_SOL ? "wSOL" : "USDC"}
                                </p>
                                <p>Transaction ID: {result.txHash}</p>
                                <a
                                    href={result.explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="explorer-link"
                                >
                                    View on Solscan
                                </a>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SolanaSwapTransaction;
