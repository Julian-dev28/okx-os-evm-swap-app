import React, { useState } from "react";
import { getCrossChainQuote } from "../utils/dexUtils";
import "./theme.css";

const CrossChainSwap = () => {
    const [amount, setAmount] = useState("");
    const [displayValue, setDisplayValue] = useState("");
    const [quoteData, setQuoteData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showQuoteDetails, setShowQuoteDetails] = useState(true);
    const [toChainId, setToChainId] = useState("");
    const [toTokenAddress, setToTokenAddress] = useState("");
    const tokenDecimals = 18;

    const handleAmountChange = (e) => {
        const input = e.target.value;
        setDisplayValue(input);

        if (input === "") {
            setAmount("");
        } else {
            const [whole = "", decimal = ""] = input.split(".");
            const cleanedWhole = whole.replace(/^0+/, "") || "0";
            const paddedDecimal = decimal
                .padEnd(tokenDecimals, "0")
                .slice(0, tokenDecimals);
            const fullNumber = cleanedWhole + paddedDecimal;
            setAmount(fullNumber);
        }
    };

    const getQuote = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("Requesting quote for amount:", amount);
            const result = await getCrossChainQuote(amount, toChainId, toTokenAddress);
            console.log("Full quote response:", result);
            setQuoteData(result);
        } catch (err) {
            console.error("Quote error:", err);
            setError("Failed to fetch quote: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatAmount = (amount, decimals = 18) => {
        return (Number(amount) / 10 ** decimals).toFixed(6);
    };

    const renderQuoteDetails = () => {
        if (!quoteData?.data?.[0]?.routerList?.[0]) {
            console.log('Missing expected data structure:', quoteData);
            return null;
        }

        const quote = quoteData.data[0];
        const route = quote.routerList[0];

        return (
            <div className="quote-details">
                <h3>Quote Details</h3>
                <div className="result-details">
                    {/* Chain Information */}
                    <div className="result-item">
                        <span className="result-key">From Chain:</span>
                        <span className="result-value">
                            Avalanche (Chain ID: {quote?.fromChainId})
                        </span>
                    </div>
                    <div className="result-item">
                        <span className="result-key">To Chain:</span>
                        <span className="result-value">
                            Chain ID: {quote?.toChainId}
                        </span>
                    </div>

                    {/* Token Information */}
                    {quote?.fromToken && (
                        <div className="result-item">
                            <span className="result-key">You Pay:</span>
                            <span className="result-value">
                                {formatAmount(quote.fromTokenAmount)} {quote.fromToken.tokenSymbol}
                            </span>
                        </div>
                    )}

                    {quote?.toToken && (
                        <div className="result-item">
                            <span className="result-key">You Receive:</span>
                            <span className="result-value">
                                {formatAmount(route.toTokenAmount)} {quote.toToken.tokenSymbol}
                            </span>
                        </div>
                    )}

                    {/* Bridge Details */}
                    {route?.router && (
                        <>
                            <div className="result-item">
                                <span className="result-key">Bridge:</span>
                                <span className="result-value">{route.router.bridgeName}</span>
                            </div>
                            {route.estimateTime && (
                                <div className="result-item">
                                    <span className="result-key">Estimated Time:</span>
                                    <span className="result-value">{route.estimateTime} seconds</span>
                                </div>
                            )}
                            {route.router.crossChainFee && (
                                <div className="result-item">
                                    <span className="result-key">Cross Chain Fee:</span>
                                    <span className="result-value">{route.router.crossChainFee} USDC</span>
                                </div>
                            )}
                        </>
                    )}

                    {/* Network Fees */}
                    {route?.fromChainNetworkFee && (
                        <div className="result-item">
                            <span className="result-key">Source Network Fee:</span>
                            <span className="result-value">{formatAmount(route.fromChainNetworkFee)} MNT</span>
                        </div>
                    )}

                    {route?.toChainNetworkFee && (
                        <div className="result-item">
                            <span className="result-key">Destination Network Fee:</span>
                            <span className="result-value">{formatAmount(route.toChainNetworkFee)}</span>
                        </div>
                    )}

                    {/* Minimum Received */}
                    {route?.minimumReceived && (
                        <div className="result-item">
                            <span className="result-key">Minimum Received:</span>
                            <span className="result-value">{formatAmount(route.minimumReceived)}</span>
                        </div>
                    )}

                    {/* Route Information */}
                    {route?.fromDexRouterList?.[0]?.subRouterList?.[0]?.dexProtocol?.[0] && (
                        <div className="result-item">
                            <span className="result-key">Source Route:</span>
                            <span className="result-value">
                                MNT → USDC ({route.fromDexRouterList[0].subRouterList[0].dexProtocol[0].dexName})
                            </span>
                        </div>
                    )}

                    {route?.toDexRouterList?.[0]?.subRouterList?.[0]?.dexProtocol?.[0] && (
                        <div className="result-item">
                            <span className="result-key">Destination Route:</span>
                            <span className="result-value">
                                USDC → ETH ({route.toDexRouterList[0].subRouterList[0].dexProtocol[0].dexName})
                            </span>
                        </div>
                    )}

                    {/* Gas Estimate */}
                    {route?.estimateGasFee && (
                        <div className="result-item">
                            <span className="result-key">Estimated Gas:</span>
                            <span className="result-value">{formatAmount(route.estimateGasFee, 8)} MNT</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="quote-container">
            <h2>MNT → ETH Cross Chain Quote</h2>
            <div className="input-container">
                <label htmlFor="amount">Amount of MNT:</label>
                <input
                    type="number"
                    id="amount"
                    value={displayValue}
                    onChange={handleAmountChange}
                    placeholder="Enter amount"
                    step="0.000000000000000001"
                />
            </div>

            <button
                onClick={getQuote}
                disabled={loading || !amount}
                className="quote-button"
            >
                {loading ? "Loading..." : "Get Quote"}
            </button>

            {error && <p className="error-message">{error}</p>}

            {quoteData && (
                <div>
                    <button
                        onClick={() => setShowQuoteDetails(!showQuoteDetails)}
                        className="toggle-button"
                    >
                        {showQuoteDetails ? "Hide Quote Details" : "Show Quote Details"}
                    </button>
                    {showQuoteDetails && renderQuoteDetails()}
                </div>
            )}
        </div>
    );
};

export default CrossChainSwap;