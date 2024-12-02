import React from "react";
import RequestQuote from "./components/requestQuote";
import CrossChainSwap from "./components/requestCCQuote";
import AllowanceChecker from "./components/allowanceChecker";
import ApproveTransaction from "./components/approveTransaction";
import SwapTransaction from "./components/swapTransaction";
// import SwapTransactionReverse from './components/swapTransactionReverse';
import SwapTransactionCC from "./components/swapCCTransaction";
import "./App.css";

function App() {
  return (
    <div className="App">
      <h1>OKX DEX API Demo</h1>
      <RequestQuote />
      <CrossChainSwap />
      {/* <AllowanceChecker />
      <ApproveTransaction /> */}
      <SwapTransaction />
      <SwapTransactionCC />
      {/* <SwapTransactionReverse /> */}
    </div>
  );
}

export default App;
