import React, { useState, useEffect } from 'react';
import { getAllowance, user, fromTokenAddress, spenderAddress } from '../utils/dexUtils';
import './theme.css';

const AllowanceChecker = () => {
    const [allowance, setAllowance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAllowance = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAllowance(user, spenderAddress, fromTokenAddress);
            setAllowance(result);
        } catch (err) {
            setError('Failed to fetch allowance');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllowance();
    }, []);

    const formatNumberWithCommas = (number) => {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    return (
        <div className="allowance-container">
            <h2>Current Allowance</h2>
            {loading && <p className="loading-message">Loading allowance...</p>}
            {error && <p className="error-message">Error: {error}</p>}
            {allowance !== null && (
                <p className="allowance-value">{formatNumberWithCommas(allowance / 10 ** 6)} USDC </p>
            )}
            <button
                onClick={fetchAllowance}
                disabled={loading}
                className="refresh-button"
            >
                {loading ? 'Refreshing...' : 'Refresh Allowance'}
            </button>
        </div>
    );
};

export default AllowanceChecker;