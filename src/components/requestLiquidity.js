import React, { useState, useEffect } from "react";
import {
  getLiquidity,
  SOLANA_CHAIN_ID,
  NATIVE_SOL,
  WRAPPED_SOL,
} from "../utils/dexUtils";
import "./theme.css";

const RequestLiquidity = () => {
  const [liquiditySources, setLiquiditySources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchLiquiditySources();
  }, []);

  const fetchLiquiditySources = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getLiquidity();
      if (!result.data) {
        throw new Error("No liquidity sources available");
      }
      setLiquiditySources(result.data);
    } catch (err) {
      setError(err.message || "Failed to fetch liquidity sources");
      console.error("Liquidity fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderLiquidityList = () => {
    if (!liquiditySources.length) return null;

    const groupedByType = liquiditySources.reduce((acc, source) => {
      // Extract type from name (e.g., "Uniswap V3" -> "Uniswap")
      const baseType = source.name.split(" ")[0];
      if (!acc[baseType]) {
        acc[baseType] = [];
      }
      acc[baseType].push(source);
      return acc;
    }, {});

    return (
      <div className="liquidity-details">
        {Object.entries(groupedByType).map(([type, sources]) => (
          <div key={type} className="liquidity-group">
            <h3>{type}</h3>
            <div className="sources-grid">
              {sources.map((source) => (
                <div key={source.id} className="dex-card">
                  <div className="dex-header">
                    {source.logo && (
                      <img
                        src={source.logo}
                        alt={`${source.name} logo`}
                        className="dex-logo"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <div className="dex-info">
                      <h4>{source.name}</h4>
                      <span className="dex-id">ID: {source.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="quote-container">
      <h2>Available Liquidity Sources</h2>

      <button
        onClick={fetchLiquiditySources}
        disabled={loading}
        className="quote-button"
      >
        {loading ? "Loading Sources..." : "Refresh Sources"}
      </button>

      {error && <p className="error-message">{error}</p>}

      {liquiditySources.length > 0 && (
        <div className="liquidity-container">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="toggle-button"
          >
            {showDetails ? "Hide Sources" : "Show Sources"}
          </button>
          <div className="liquidity-stats">
            <div className="stat-item">
              <span className="stat-label">Total Sources</span>
              <span className="stat-value">{liquiditySources.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Unique Protocols</span>
              <span className="stat-value">
                {
                  new Set(liquiditySources.map((s) => s.name.split(" ")[0]))
                    .size
                }
              </span>
            </div>
          </div>
          {showDetails && renderLiquidityList()}
        </div>
      )}
    </div>
  );
};

export default RequestLiquidity;
