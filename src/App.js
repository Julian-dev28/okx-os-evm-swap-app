import React from "react";
import RequestQuote from "./components/requestQuote";
import RequestLiquidity from "./components/requestLiquidity";
import CrossChainQuote from "./components/crossChainSwapQuote";
// import AllowanceChecker from './components/allowanceChecker';
import ApproveTransaction from "./components/approveTransaction";
import CrossChainSwapTransaction from "./components/swapTransaction";
import SolanaSwapTransaction from "./components/solanaSwapTransaction";
import "./App.css";

function App() {
  return (
    <div className="App">
      <h1>OKX DEX Swap</h1>
      <RequestQuote />
      <CrossChainQuote />
      <RequestLiquidity />
      <ApproveTransaction />
      <CrossChainSwapTransaction />
      <SolanaSwapTransaction />
    </div>
  );
}

export default App;
