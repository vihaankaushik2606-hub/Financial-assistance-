function classifyProviderError(message, status) {
  const text = String(message || "").toLowerCase();
  if (status === 429 || /rate limit|frequency|limit reached|too many requests/.test(text)) {
    return {
      code: "FMP_RATE_LIMIT",
      message: "Market data request limit reached. Please wait a moment before trying again."
    };
  }
  if (/invalid api.?key|api.?key is invalid|invalid key|invalid credentials/.test(text) || status === 401) {
    return {
      code: "FMP_INVALID_KEY",
      message: "The market data provider rejected the API key. Please check FMP_API_KEY in your .env file."
    };
  }
  if (/premium|entitlement|subscription|upgrade|restricted|not authorized|not available.*plan|access.*plan|not.*access|access.*not/.test(text) || status === 402 || status === 403) {
    return {
      code: "FMP_ACCESS_DENIED",
      message: "This stock or financial endpoint requires an upgraded tier on Financial Modeling Prep."
    };
  }
  return {
    code: "FMP_UPSTREAM_ERROR",
    message: "Unable to retrieve data for this ticker right now. Please verify the symbol or try again shortly."
  };
}

module.exports = { classifyProviderError };
