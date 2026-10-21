function classifyProviderError(message, status) {
  const text = String(message || "").toLowerCase();
  if (status === 429 || /rate limit|frequency|limit reached|too many requests/.test(text)) {
    return { code: "FMP_RATE_LIMIT", message: "FMP request limit reached. Please try again later." };
  }
  if (/invalid api.?key|api.?key is invalid|invalid key|invalid credentials/.test(text) || status === 401) {
    return { code: "FMP_INVALID_KEY", message: "FMP rejected authentication. Check the FMP key saved in the server environment." };
  }
  if (/premium|entitlement|subscription|upgrade|restricted|not authorized|not available.*plan|access.*plan|not.*access|access.*not/.test(text) || status === 402 || status === 403) {
    return { code: "FMP_ACCESS_DENIED", message: "FMP denied access to this endpoint or symbol. Check your account permissions and plan coverage." };
  }
  return { code: "FMP_UPSTREAM_ERROR", message: "FMP could not complete this request. Its response does not establish an invalid key." };
}
module.exports = { classifyProviderError };
