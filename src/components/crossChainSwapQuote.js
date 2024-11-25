import React, { useState } from "react";
import {
    getCrossChainQuote,
    userAddress,
    NATIVE_SOL,
    ETH,
} from "../utils/dexUtils";
import "./theme.css";

const CrossChainQuote = () => {
    const [amount, setAmount] = useState("");
    const [displayValue, setDisplayValue] = useState("");
    const [quoteData, setQuoteData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showQuoteDetails, setShowQuoteDetails] = useState(true);
    const tokenDecimals = 9; // SOL decimals

    // Fixed cross-chain parameters for SOL -> Polygon
    const fromChainId = "501"; // Solana
    const toChainId = "137"; // Polygon
    const toTokenAddress = ETH; // Native ETH/MATIC on Polygon

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
            const quoteParams = {
                fromChainId,
                toChainId,
                fromTokenAddress: NATIVE_SOL,
                toTokenAddress,
                amount: amount,
                slippage: "0.01",
                userWalletAddress: userAddress,
                priceImpactProtectionPercentage: "1",
                sort: "0",
            };

            const result = await getCrossChainQuote(quoteParams);
            console.log("Quote response:", result);
            setQuoteData(result);
        } catch (err) {
            console.error("Quote error:", err);
            setError("Failed to fetch quote: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatAmount = (amount, decimals = tokenDecimals) => {
        if (!amount) return "N/A";
        try {
            const amountBig = BigInt(amount);
            const divisor = BigInt(10 ** decimals);
            const wholePart = amountBig / divisor;
            const fractionalPart = amountBig % divisor;
            const fractionalStr = fractionalPart
                .toString()
                .padStart(decimals, "0");
            const fullNumber = `${wholePart}.${fractionalStr}`;
            return parseFloat(fullNumber).toFixed(4);
        } catch (err) {
            console.error("Format error:", err);
            return "N/A";
        }
    };

    const renderQuoteDetails = () => {
        if (!quoteData?.data?.[0]) return null;

        const quote = quoteData.data[0];
        console.log("Full quote data:", quote); // Debug log

        const renderTokenInfo = (token, label) => (
            <div className="token-info">
                <h4>{label}</h4>
                <p>
                    <strong>Symbol:</strong> {token.tokenSymbol}
                </p>
                <p>
                    <strong>Address:</strong> {token.tokenContractAddress}
                </p>
                <p>
                    <strong>Decimals:</strong> {token.decimals}
                </p>
            </div>
        );

        const renderDexRouterList = (routerList, label) => {
            if (!routerList?.length) return null;
            return (
                <div className="dex-section">
                    <h4>{label}</h4>
                    {routerList.map((router, index) => (
                        <div key={index} className="dex-route-card">
                            <div className="dex-header">
                                <h5>Router {index + 1}</h5>
                                <div className="dex-percent">
                                    Percentage: {router.percent}%
                                </div>
                            </div>
                            <div className="dex-details">
                                <div className="router-path">
                                    <strong>Router Path:</strong>
                                    <div className="router-address">
                                        {router.router}
                                    </div>
                                </div>
                                {router.subRouterList?.map(
                                    (subRouter, subIndex) => (
                                        <div
                                            key={subIndex}
                                            className="protocol-card"
                                        >
                                            <div className="protocol-header">
                                                <span>
                                                    Protocol #{subIndex + 1}
                                                </span>
                                                <span>
                                                    {subRouter.percent}%
                                                </span>
                                            </div>
                                            <div className="protocol-details">
                                                <p>
                                                    <strong>DEX Name:</strong>{" "}
                                                    {subRouter.dexName}
                                                </p>
                                                {renderTokenInfo(
                                                    subRouter.fromToken,
                                                    "From Token",
                                                )}
                                                {renderTokenInfo(
                                                    subRouter.toToken,
                                                    "To Token",
                                                )}
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        };

        return (
            <div className="quote-details">
                <h3>Route Details</h3>
                <div className="basic-info">
                    {/* Chain Information */}
                    <div className="info-group">
                        <h4>Chain Information</h4>
                        <div className="info-row">
                            <p>
                                <strong>From Chain ID:</strong>{" "}
                                {quote.fromChainId}
                            </p>
                            <p>
                                <strong>To Chain ID:</strong> {quote.toChainId}
                            </p>
                        </div>
                    </div>

                    {/* Token Information */}
                    <div className="info-group">
                        {renderTokenInfo(quote.fromToken, "Source Token")}
                        {renderTokenInfo(quote.toToken, "Destination Token")}
                    </div>

                    {/* Amount Information */}
                    <div className="info-group">
                        <h4>Amount Details</h4>
                        <div className="info-row">
                            <p>
                                <strong>Input Amount:</strong>{" "}
                                {formatAmount(
                                    quote.fromTokenAmount,
                                    quote.fromToken.decimals,
                                )}{" "}
                                {quote.fromToken.tokenSymbol}
                            </p>
                            <p>
                                <strong>Output Amount:</strong>{" "}
                                {formatAmount(
                                    quote.toTokenAmount,
                                    quote.toToken.decimals,
                                )}{" "}
                                {quote.toToken.tokenSymbol}
                            </p>
                        </div>
                        <div className="info-row">
                            <p>
                                <strong>Minimum Received:</strong>{" "}
                                {formatAmount(
                                    quote.minimumReceived,
                                    quote.toToken.decimals,
                                )}{" "}
                                {quote.toToken.tokenSymbol}
                            </p>
                        </div>
                    </div>

                    {/* Router Information */}
                    {quote.routerList?.map((route, index) => (
                        <div key={index} className="route-info">
                            <div className="bridge-details">
                                <h4>Bridge Information</h4>
                                <p>
                                    <strong>Bridge Name:</strong>{" "}
                                    {route.router?.bridgeName}
                                </p>
                                <p>
                                    <strong>Bridge ID:</strong>{" "}
                                    {route.router?.bridgeId}
                                </p>
                                <p>
                                    <strong>Estimated Time:</strong>{" "}
                                    {route.estimatedTime}s
                                </p>
                                <p>
                                    <strong>Gas Fee:</strong>{" "}
                                    {formatAmount(
                                        route.estimateGasFee,
                                        quote.fromToken.decimals,
                                    )}{" "}
                                    {quote.fromToken.tokenSymbol}
                                </p>
                                <p>
                                    <strong>Cross Chain Fee:</strong>{" "}
                                    {route.router?.crossChainFee}
                                </p>
                                <p>
                                    <strong>Other Native Fee:</strong>{" "}
                                    {route.router?.otherNativeFee}
                                </p>
                                <p>
                                    <strong>Fee Token:</strong>{" "}
                                    {route.router?.crossChainFeeTokenAddress}
                                </p>
                            </div>

                            <div className="network-fees">
                                <h4>Network Fees</h4>
                                <p>
                                    <strong>Source Network Fee:</strong>{" "}
                                    {formatAmount(
                                        route.fromChainNetworkFee,
                                        quote.fromToken.decimals,
                                    )}{" "}
                                    {quote.fromToken.tokenSymbol}
                                </p>
                                <p>
                                    <strong>Destination Network Fee:</strong>{" "}
                                    {formatAmount(
                                        route.toChainNetworkFee,
                                        quote.toToken.decimals,
                                    )}{" "}
                                    {quote.toToken.tokenSymbol}
                                </p>
                            </div>

                            {/* DEX Router Lists */}
                            {renderDexRouterList(
                                route.fromDexRouterList,
                                "Source Chain DEX Routes",
                            )}
                            {renderDexRouterList(
                                route.toDexRouterList,
                                "Destination Chain DEX Routes",
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="quote-container">
            <h2>SOL → MATIC Cross Chain Quote</h2>

            <div className="input-container">
                <label htmlFor="amount">Amount (SOL):</label>
                <input
                    type="number"
                    id="amount"
                    value={displayValue}
                    onChange={handleAmountChange}
                    placeholder="Enter amount"
                    step="0.000000001"
                    min="0"
                    className="amount-input"
                />
            </div>

            <button
                onClick={getQuote}
                disabled={loading || !amount}
                className="quote-button"
            >
                {loading ? "Loading..." : "Get Quote"}
            </button>

            {error && <div className="error-message">{error}</div>}

            {quoteData && (
                <div>
                    <button
                        onClick={() => setShowQuoteDetails(!showQuoteDetails)}
                        className="toggle-button"
                    >
                        {showQuoteDetails
                            ? "Hide Quote Details"
                            : "Show Quote Details"}
                    </button>
                    {showQuoteDetails && renderQuoteDetails()}
                </div>
            )}
        </div>
    );
};

export default CrossChainQuote;
