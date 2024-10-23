import React, { useState } from "react";
import {
  getQuote,
  chainId,
  fromTokenAddress,
  toTokenAddress,
} from "../utils/dexUtils";
import "./theme.css";

const RequestQuote = () => {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromAmount, setFromAmount] = useState("");
  const [showQuoteDetails, setShowQuoteDetails] = useState(true);
  const tokenDecimals = 6; // Assuming 6 decimals, adjust if needed

  const handleAmountChange = (e) => {
    const input = e.target.value;
    if (input === "") {
      setFromAmount("");
    } else {
      const adjustedAmount = (
        parseFloat(input) * Math.pow(10, tokenDecimals)
      ).toString();
      setFromAmount(adjustedAmount);
    }
  };

  const fetchQuote = async () => {
    setLoading(true);
    setError(null);
    try {
      const quoteParams = {
        amount: fromAmount,
        chainId: chainId,
        toTokenAddress: toTokenAddress,
        fromTokenAddress: fromTokenAddress,
      };
      const result = await getQuote(quoteParams);
      setQuote(result.data[0]);
    } catch (err) {
      setError("Failed to fetch quote");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // const formatNumberWithCommas = (number) => {
  //   return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // };

  const formatAmount = (amount, decimals) => {
    const parsedAmount = parseFloat(amount) / Math.pow(10, decimals);
    return parsedAmount.toFixed(decimals);
  };

  const renderTokenInfo = (token) => (
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
      <p>
        <strong>Unit Price:</strong> $
        {parseFloat(token.tokenUnitPrice).toFixed(2)}
      </p>
    </div>
  );

  const renderQuoteDetails = () => {
    if (!quote) return null;
    const fromAmountFormatted = parseFloat(
      formatAmount(quote.fromTokenAmount, quote.fromToken.decimal),
    ).toFixed(2);
    const toAmountFormatted = parseFloat(
      formatAmount(quote.toTokenAmount, quote.toToken.decimal),
    ).toFixed(4);
    const estimateGasFeeFormatted =
      formatAmount(quote.estimateGasFee, quote.fromToken.decimal) / 10;

    return (
      <div className="quote-details">
        <h3>Quote Details</h3>
        <p>
          <strong>Chain ID:</strong> {quote.chainId}
        </p>
        <p>
          <strong>Estimate Gas Fee:</strong>{" "}
          {parseFloat(estimateGasFeeFormatted).toFixed(4)}
        </p>
        <h4>From Token</h4>
        {renderTokenInfo(quote.fromToken)}
        <p>
          <strong>From Amount:</strong> {fromAmountFormatted}{" "}
          {quote.fromToken.tokenSymbol}
        </p>
        <h4>To Token</h4>
        {renderTokenInfo(quote.toToken)}
        <p>
          <strong>To Amount:</strong> {toAmountFormatted}{" "}
          {quote.toToken.tokenSymbol}
        </p>
        <h4>Quote Comparisons</h4>
        <ul className="quote-compare-list">
          {quote.quoteCompareList.map((comparison, index) => (
            <li key={index}>
              <p>
                <strong>{comparison.dexName}</strong>
              </p>
              <p>
                Amount Out: {parseFloat(comparison.amountOut).toFixed(4)}{" "}
                {quote.toToken.tokenSymbol}
              </p>
              <p>Trade Fee: {parseFloat(comparison.tradeFee).toFixed(4)}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="quote-container">
      <h2>Quote Request</h2>
      <div className="input-container">
        <label htmlFor="fromAmount">Enter amount:</label>
        <input
          type="number"
          id="fromAmount"
          value={
            fromAmount
              ? (
                  parseFloat(fromAmount) / Math.pow(10, tokenDecimals)
                ).toString()
              : ""
          }
          onChange={handleAmountChange}
          placeholder="Enter amount"
          step={`1e-${tokenDecimals}`}
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
