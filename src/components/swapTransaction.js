import React, { useState, useCallback } from 'react';
import BN from 'bn.js';
import { sendSwapTx, chainId, fromTokenAddress, toTokenAddress, user } from '../utils/dexUtils';
import './theme.css';

const SwapTransaction = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [txHash, setTxHash] = useState(null);
    const [amount, setAmount] = useState('');
    const tokenDecimals = 18;

    const convertToTokenUnits = (inputAmount) => {
        // Convert amount to token units using BN
        const [whole, decimal = ''] = inputAmount.split('.');
        const decimals = decimal.padEnd(tokenDecimals, '0').slice(0, tokenDecimals);
        const amount = whole + decimals;
        return new BN(amount).toString();
    };

    const validateSwapParams = useCallback((amount) => {
        const errors = [];

        if (!amount) {
            errors.push('Please enter an amount to swap');
            return errors;
        }

        if (isNaN(amount) || parseFloat(amount) <= 0) {
            errors.push('Invalid amount');
        }

        if (!fromTokenAddress || !fromTokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            errors.push('Invalid from token address');
        }
        if (!toTokenAddress || !toTokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            errors.push('Invalid to token address');
        }

        if (!user || !user.match(/^0x[a-fA-F0-9]{40}$/)) {
            errors.push('Invalid wallet address');
        }

        return errors;
    }, []);

    const handleAmountChange = (e) => {
        setAmount(e.target.value);
        setError(null);
    };

    const handleSwap = async () => {
        setLoading(true);
        setError(null);
        try {
            const validationErrors = validateSwapParams(amount);
            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join(', '));
            }

            const amountInTokenUnits = convertToTokenUnits(amount);

            const swapParams = {
                chainId: chainId,
                fromTokenAddress: fromTokenAddress,
                toTokenAddress: toTokenAddress,
                amount: amountInTokenUnits,
                slippage: '0.5',
                userWalletAddress: user
            };

            const swapData = await sendSwapTx(swapParams);
            setResult(swapData);
            if (swapData.blockHash) {
                setTxHash(swapData.transactionHash);
            }
        } catch (err) {
            setError('Failed to execute swap: ' + (err.message || ''));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderResult = () => {
        if (!result) return null;

        // Handle blockchain transaction result
        if (result.blockHash) {
            return (
                <div className="result-container">
                    <h3>Swap Transaction Completed</h3>
                    <div className="result-details">
                        <div className="result-item">
                            <span className="result-key">Block Hash:</span>
                            <span className="result-value">{result.blockHash}</span>
                        </div>
                        <div className="result-item">
                            <span className="result-key">Block Number:</span>
                            <span className="result-value">{result.blockNumber?.toString()}</span>
                        </div>
                        <div className="result-item">
                            <span className="result-key">Gas Used:</span>
                            <span className="result-value">{result.cumulativeGasUsed?.toString()}</span>
                        </div>
                        <div className="result-item">
                            <span className="result-key">Gas Price:</span>
                            <span className="result-value">{result.effectiveGasPrice?.toString()}</span>
                        </div>
                        <div className="result-item">
                            <span className="result-key">From:</span>
                            <span className="result-value">{result.from}</span>
                        </div>
                        {txHash && (
                            <div className="result-item">
                                <span className="result-key">Transaction Hash:</span>
                                <span className="result-value">{txHash}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Handle swap data result
        if (Array.isArray(result) && result.length > 0 && result[0].routerResult) {
            const swapInfo = result[0];
            return (
                <div className="result-container">
                    <h3>Swap Transaction Details</h3>
                    <div className="result-details">
                        {swapInfo.routerResult && (
                            <div className="result-item">
                                <span className="result-key">Router Result:</span>
                                <div className="result-value">
                                    <pre>{JSON.stringify(swapInfo.routerResult, null, 2)}</pre>
                                </div>
                            </div>
                        )}
                        {swapInfo.tx && (
                            <div className="result-item">
                                <span className="result-key">Transaction Data:</span>
                                <div className="result-value">
                                    <pre>{JSON.stringify(swapInfo.tx, null, 2)}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="approve-transaction-container">
            <h2>Swap Transaction</h2>
            <div className="input-container">
                <label htmlFor="approveAmount">Enter amount to swap:</label>
                <input
                    type="number"
                    id="approveAmount"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="Enter amount"
                    step="0.000000000000000001"
                />
            </div>
            {loading ? (
                <p className="loading-message">Processing swap transaction...</p>
            ) : error ? (
                <p className="error-message">Error: {error}</p>
            ) : (
                <>
                    <button onClick={handleSwap} className="approve-button" disabled={!amount}>
                        Swap
                    </button>
                    {renderResult()}
                </>
            )}
        </div>
    );
};

export default SwapTransaction;