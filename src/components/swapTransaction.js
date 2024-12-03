import React, { useState, useCallback } from "react";
import BN from "bn.js";
import {
    sendCrossChainSwap,
    getCrossChainQuote,
    userAddress,
    SOLANA_CHAIN_ID,
    NATIVE_SOL,
    ETH,
} from "../utils/dexUtils";
import "./theme.css";

const CrossChainSwapTransaction = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [txHash, setTxHash] = useState(null);
    const [amount, setAmount] = useState("");
    const tokenDecimals = 9; // SOL decimals

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

    const validateSwapParams = useCallback((amount) => {
        const errors = [];
        if (!amount) {
            errors.push("Please enter an amount to swap");
            return errors;
        }
        if (isNaN(amount) || parseFloat(amount) <= 0) {
            errors.push("Invalid amount");
        }
        return errors;
    }, []);

    const handleAmountChange = (e) => {
        setAmount(e.target.value);
        setError(null);
    };

    const handleSwap = async () => {
        try {
            setLoading(true);
            setError(null);

            const lamports = convertToLamports(amount);
            console.log("Amount in lamports:", lamports);

            // Get quote first
            const quote = await getCrossChainQuote({
                fromChainId: SOLANA_CHAIN_ID,
                toChainId: "137",
                fromTokenAddress: NATIVE_SOL,
                toTokenAddress: ETH,
                amount: lamports,
                slippage: "0.05",
                userWalletAddress: userAddress,
                recieveAddress: "0x9163756d2a83a334de2cc0c3aa1df9a5fc21369d",
                priceImpactProtectionPercentage: "1",
            });

            const swapResult = await sendCrossChainSwap(lamports, userAddress);
            setResult(swapResult);
            if (swapResult.transactionId) {
                setTxHash(swapResult.transactionId);
            }
        } catch (error) {
            console.error("Swap error:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderResult = () => {
        if (!result) return null;

        return (
            <div className="result-container">
                <h3>Swap Transaction Completed</h3>
                <div className="result-details">
                    {txHash && (
                        <div className="result-item">
                            <span className="result-key">Transaction ID:</span>
                            <span className="result-value">{txHash}</span>
                        </div>
                    )}

                    {result.explorerUrl && (
                        <div className="result-item">
                            <span className="result-key">Explorer URL:</span>
                            <a
                                href={result.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="result-value explorer-link"
                            >
                                View on Solscan
                            </a>
                        </div>
                    )}

                    {result.signature && (
                        <div className="result-item">
                            <span className="result-key">Signature:</span>
                            <span className="result-value">
                                {result.signature}
                            </span>
                        </div>
                    )}

                    {result.confirmationStatus && (
                        <div className="result-item">
                            <span className="result-key">Status:</span>
                            <span className="result-value status-confirmed">
                                {result.confirmationStatus}
                            </span>
                        </div>
                    )}
                </div>

                {result.rawTransaction && (
                    <div className="result-item">
                        <span className="result-key">Transaction Data:</span>
                        <div className="result-value">
                            <pre>
                                {JSON.stringify(result.rawTransaction, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="approve-transaction-container">
            <h2>Cross Chain Swap Transaction</h2>
            <div className="input-container">
                <label htmlFor="approveAmount">Enter SOL amount to swap:</label>
                <input
                    type="number"
                    id="approveAmount"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="Enter amount in SOL"
                    step="0.000000001"
                    min="0"
                    className="approve-input"
                />
            </div>

            {loading ? (
                <p className="loading-message">
                    Processing cross-chain swap...
                </p>
            ) : error ? (
                <p className="error-message">Error: {error}</p>
            ) : (
                <>
                    <button
                        onClick={handleSwap}
                        className="approve-button"
                        disabled={!amount || loading}
                    >
                        Swap
                    </button>
                    {renderResult()}
                </>
            )}
        </div>
    );
};

export default CrossChainSwapTransaction;
