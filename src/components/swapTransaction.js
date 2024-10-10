import React, { useState } from 'react';
import { sendSwapTx, chainId, fromTokenAddress, toTokenAddress, user } from '../utils/dexUtils';
import './theme.css';

const SwapTransaction = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [amount, setAmount] = useState('');

    const handleAmountChange = (e) => {
        setAmount(e.target.value);
    };


    const handleSwap = async () => {
        setLoading(true);
        setError(null);
        try {
            const swapParams = {
                chainId: chainId,
                fromTokenAddress: fromTokenAddress,
                toTokenAddress: toTokenAddress,
                amount: amount,
                slippage: '0.03',
                userWalletAddress: user
            };
            const swapResult = await sendSwapTx(swapParams);
            setResult(`Swap transaction sent. Hash: ${swapResult.transactionHash}`);
        } catch (err) {
            setError('Failed to execute swap');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p className="loading-message">Executing swap...</p>;
    if (error) return <p className="error-message">Error: {error}</p>;

    return (
        <div>
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
                <p className="loading-message">Approving transaction...</p>
            ) : error ? (
                <p className="error-message">Error: {error}</p>
            ) : (
                <>
                    <button onClick={handleSwap} className="swap-button" disabled={!amount}>Swap</button>
                    {result && <pre>{result}</pre>}
                </>
            )}
        </div>

    );
};

export default SwapTransaction;