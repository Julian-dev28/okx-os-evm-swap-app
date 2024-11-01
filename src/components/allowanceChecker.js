import React, { useState, useEffect } from "react";
import BN from "bn.js";
import {
    getAllowance,
    user,
    fromTokenAddress,
    spenderAddress,
} from "../utils/dexUtils";
import "./theme.css";

const AllowanceChecker = () => {
    const [allowance, setAllowance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const tokenDecimals = 18;

    const fetchAllowance = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAllowance(
                user,
                spenderAddress,
                fromTokenAddress,
            );
            console.log("Raw allowance (wei):", result);
            setAllowance(result);
        } catch (err) {
            setError("Failed to fetch allowance");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllowance();
    }, []);

    const convertScientificToString = (scientific) => {
        const [mantissa, exponent] = scientific.toString().split('e+');
        const exponentNum = parseInt(exponent || '0');

        let number = mantissa.replace('.', '');
        if (mantissa.includes('.')) {
            const decimals = mantissa.split('.')[1].length;
            exponentNum -= decimals;
        }

        number = number + '0'.repeat(exponentNum);
        return number;
    };

    const formatWeiToTokens = (weiAmount) => {
        try {
            // Convert from scientific notation if needed
            const weiString = weiAmount.toString().includes('e') 
                ? convertScientificToString(weiAmount)
                : weiAmount.toString();

            console.log("WeZi string:", weiString);

            const wei = new BN(weiString);
            const divisor = new BN(10).pow(new BN(tokenDecimals));
            const tokens = wei.div(divisor);

            return tokens.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        } catch (err) {
            console.error('Error formatting wei amount:', err);
            return '0';
        }
    };

    return (
        <div className="allowance-container">
            <h2>Current Allowance</h2>
            {loading && <p className="loading-message">Loading allowance...</p>}
            {error && <p className="error-message">Error: {error}</p>}
            {allowance !== null && (
                <p className="allowance-value">
                    {formatWeiToTokens(allowance)} FOXY{" "}
                </p>
            )}
            <button
                onClick={fetchAllowance}
                disabled={loading}
                className="refresh-button"
            >
                {loading ? "Refreshing..." : "Refresh Allowance"}
            </button>
        </div>
    );
};

export default AllowanceChecker;