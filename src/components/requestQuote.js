import React, { useState } from "react";
import {
  getQuote,
  SOLANA_CHAIN_ID,
  NATIVE_SOL,
  WRAPPED_SOL,
  USDC_SOL,
  ETH,
} from "../utils/dexUtils";
import "./theme.css";

const RequestQuote = () => {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromAmount, setFromAmount] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [showQuoteDetails, setShowQuoteDetails] = useState(true);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const tokenDecimals = 6; // SOL decimals

  const handleAmountChange = (e) => {
    const input = e.target.value;
    setDisplayValue(input);

    if (input === "") {
      setFromAmount("");
      return;
    }

    try {
      // Convert to lamports
      const value = parseFloat(input);
      if (isNaN(value)) {
        setFromAmount("");
        return;
      }
      const lamports = Math.floor(value * Math.pow(10, tokenDecimals));
      setFromAmount(lamports.toString());
    } catch (err) {
      console.error("Amount conversion error:", err);
      setFromAmount("");
    }
  };

  const fetchQuote = async () => {
    setLoading(true);
    setError(null);
    try {
      const quoteParams = {
        amount: fromAmount,
        chainId: SOLANA_CHAIN_ID,
        fromTokenAddress: NATIVE_SOL,
        toTokenAddress: ETH,
        slippage: "0.05",
      };
      const result = await getQuote(quoteParams);
      if (!result.data?.[0]) {
        throw new Error("No quote data available");
      }
      setQuote(result.data[0]);
    } catch (err) {
      setError(err.message || "Failed to fetch quote");
      console.error("Quote error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount, decimals = tokenDecimals) => {
    if (!amount) return "0";
    try {
      // Parse the string to a BigInt first to handle large numbers
      const amountBig = BigInt(amount);
      const divisor = BigInt(10 ** decimals);

      // Convert to a decimal string with proper precision
      const wholePart = amountBig / divisor;
      const fractionalPart = amountBig % divisor;

      // Pad the fractional part with zeros if needed
      const fractionalStr = fractionalPart.toString().padStart(decimals, "0");

      // Combine and format to 4 decimal places
      const fullNumber = `${wholePart}.${fractionalStr}`;
      return parseFloat(fullNumber).toFixed(4);
    } catch (err) {
      console.error("Format error:", err);
      return "0";
    }
  };

  const renderTokenInfo = (token) => {
    if (!token) return null;
    return (
      <div className="token-info">
        <p>
          <strong>Symbol:</strong> {token.tokenSymbol}
        </p>
        <p>
          <strong>Address:</strong> {token.tokenContractAddress}
        </p>
        <p>
          <strong>Decimals:</strong> {token.decimal}
        </p>
        {token.tokenUnitPrice && (
          <p>
            <strong>Unit Price:</strong> $
            {parseFloat(token.tokenUnitPrice).toFixed(2)}
          </p>
        )}
      </div>
    );
  };

  const renderQuoteDetails = () => {
    if (!quote) return null;

    const fromAmountFormatted = formatAmount(
      quote.fromTokenAmount,
      quote.fromToken?.decimal || tokenDecimals,
    );
    const toAmountFormatted = formatAmount(
      quote.toTokenAmount,
      quote.toToken?.decimal || tokenDecimals,
    );

    return (
      <div className="quote-details">
        <h3>Quote Details</h3>
        <p>
          <strong>Chain ID:</strong> {quote.chainId}
        </p>
        {quote.estimateGasFee && (
          <p>
            <strong>Estimate Gas Fee:</strong> {quote.estimateGasFee / 10 ** 8}{" "}
            SOL
          </p>
        )}
        <h4>From Token</h4>
        {renderTokenInfo(quote.fromToken)}
        <p>
          <strong>From Amount:</strong> {fromAmountFormatted} SOL
        </p>
        <h4>To Token</h4>
        {renderTokenInfo(quote.toToken)}
        <p>
          <strong>To Amount:</strong> {toAmountFormatted}
        </p>
        {quote.quoteCompareList && quote.quoteCompareList.length > 0 && (
          <>
            <h4>Available Routes</h4>
            <div className="quote-compare-list">
              {quote.quoteCompareList.map((comparison, index) => (
                <div key={index} className="dex-route-card">
                  <div className="dex-header">
                    {comparison.dexLogo && (
                      <img
                        src={comparison.dexLogo}
                        alt={`${comparison.dexName} logo`}
                        className="dex-logo"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <h5>{comparison.dexName}</h5>
                  </div>
                  <div className="dex-details">
                    <div className="amount-out">
                      <span>Amount Out:</span>
                      <span className="value">
                        {comparison.amountOut}{" "}
                        {quote.toToken ? quote.toToken.tokenSymbol : null}
                      </span>
                    </div>
                    {comparison.tradeFee && (
                      <div className="trade-fee">
                        <span>Trade Fee:</span>
                        <span className="value">{comparison.tradeFee} SOL</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="quote-container">
      <h2>Quote Request</h2>
      <div className="input-container">
        <label htmlFor="fromAmount">Enter amount ({`SOL→USDC`}):</label>
        <input
          type="number"
          id="fromAmount"
          value={displayValue}
          onChange={handleAmountChange}
          placeholder="Enter amount"
          step="0.000000001"
          min="0"
          className="amount-input"
        />
      </div>
      <button
        onClick={fetchQuote}
        disabled={loading || !fromAmount}
        className="quote-button"
      >
        {loading ? "Loading..." : "Get Quote"}
      </button>
      {error && <p className="error-message">{error}</p>}
      {quote && (
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

export default RequestQuote;
