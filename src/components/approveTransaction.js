import React, { useState } from 'react';
import BN from 'bn.js';
import { approveTransaction, chainId, fromTokenAddress, sendApproveTx } from '../utils/dexUtils';
import './theme.css';

const ApproveTransaction = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [txHash, setTxHash] = useState(null);
    const [amount, setAmount] = useState('');
    const tokenDecimals = 18; // Adjust this based on your token's decimals

    const handleAmountChange = (e) => {
        setAmount(e.target.value);
    };

    const convertToTokenUnits = (inputAmount) => {
        // Convert amount to token units using BN
        const [whole, decimal = ""] = inputAmount.split(".");
        const decimals = decimal.padEnd(tokenDecimals, "0").slice(0, tokenDecimals);
        const amount = whole + decimals;
        return new BN(amount).toString();
    };

    const handleApprove = async () => {
        if (!amount) {
            setError('Please enter an amount to approve');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const amountInTokenUnits = convertToTokenUnits(amount);
            const approveResult = await approveTransaction(chainId, fromTokenAddress, amountInTokenUnits);
            const sendApprovalResult = await sendApproveTx(amountInTokenUnits);
            setResult(approveResult);
            setTxHash(sendApprovalResult ? sendApprovalResult.transactionHash : null);
        } catch (err) {
            setError('Failed to approve transaction');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderResult = () => {
        if (!result) return null;
        const { code, data, msg } = result;
        return (
            <div className="result-container">
                <h3>Transaction Approved</h3>
                <div className="result-details">
                    <div className="result-item">
                        <span className="result-key">code:</span>
                        <span className="result-value">{code}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-key">data:</span>
                        <div className="result-value">
                            {data.map((item, index) => (
                                <div key={index} className="data-item">
                                    <div><strong>dexContractAddress:</strong> {item.dexContractAddress}</div>
                                    <div><strong>gasLimit:</strong> {item.gasLimit}</div>
                                    <div><strong>gasPrice:</strong> {item.gasPrice}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="result-item">
                        <span className="result-key">msg:</span>
                        <span className="result-value">{msg}</span>
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
    };

    return (
        <div className="approve-transaction-container">
            <h2>Approve Transaction</h2>
            <div className="input-container">
                <label htmlFor="approveAmount">Enter amount to approve:</label>
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
                <p className="loading-message">Approving transaction...</p>
            ) : error ? (
                <p className="error-message">Error: {error}</p>
            ) : (
                <>
                    <button onClick={handleApprove} className="approve-button" disabled={!amount}>Approve</button>
                    {renderResult()}
                </>
            )}
        </div>
    );
};

export default ApproveTransaction;