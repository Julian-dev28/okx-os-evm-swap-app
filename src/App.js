import React from 'react';
import RequestQuote from './components/requestQuote';
import AllowanceChecker from './components/allowanceChecker';
import ApproveTransaction from './components/approveTransaction';
import SwapTransaction from './components/swapTransaction';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>OKX DEX Swap</h1>
      <RequestQuote />
      <AllowanceChecker />
      <ApproveTransaction />
      <SwapTransaction />
    </div>
  );
}

export default App;