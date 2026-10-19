require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const AV_URL = "https://www.alphavantage.co/query";

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

function validSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  // Permit common ticker punctuation, while preventing arbitrary URL/input injection.
  if (!/^[A-Z0-9.^_-]{1,24}$/.test(symbol)) return null;
  return symbol;
}

// Cache provider responses in memory so repeat visits do not burn the daily API quota.
const providerCache = new Map();
const providerRequestsInFlight = new Map();
const CACHE_TTL_MS = {
  GLOBAL_QUOTE: 15 * 60 * 1000,
  TIME_SERIES_DAILY: 6 * 60 * 60 * 1000,
  INCOME_STATEMENT: 24 * 60 * 60 * 1000,
  BALANCE_SHEET: 24 * 60 * 60 * 1000,
  CASH_FLOW: 24 * 60 * 60 * 1000
};

async function alphaVantage(params) {
  if (!API_KEY) {
    const err = new Error("Server API key is not configured. Set ALPHA_VANTAGE_API_KEY in the environment.");
    err.status = 503;
    throw err;
  }

  const cacheKey = JSON.stringify(params);
  const now = Date.now();
  const cached = providerCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.data;
  if (providerRequestsInFlight.has(cacheKey)) return providerRequestsInFlight.get(cacheKey);

  const request = (async () => {
    const url = new URL(AV_URL);
    for (const [key, value] of Object.entries({ ...params, apikey: API_KEY })) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) {
      const err = new Error(`Data provider returned HTTP ${response.status}.`);
      err.status = 502;
      throw err;
    }
    const data = await response.json();
    if (data.Note || data.Information || data["Error Message"]) {
      const err = new Error(data.Note || data.Information || data["Error Message"]);
      err.status = 502;
      throw err;
    }
    const ttl = CACHE_TTL_MS[params.function] || 60 * 60 * 1000;
    providerCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
    return data;
  })();

  providerRequestsInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    providerRequestsInFlight.delete(cacheKey);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, providerConfigured: Boolean(API_KEY), service: "AI Finance Lab API" });
});

app.get("/api/quote", async (req, res) => {
  const symbol = validSymbol(req.query.symbol);
  if (!symbol) return res.status(400).json({ error: "Provide a valid ticker symbol." });
  try {
    const data = await alphaVantage({ function: "GLOBAL_QUOTE", symbol });
    const quote = data["Global Quote"] || {};
    if (!Object.keys(quote).length) {
      return res.status(404).json({ error: "No quote returned for this symbol. Check symbol format, coverage, and provider permissions.", symbol });
    }
    res.json({ symbol, source: "Alpha Vantage", fetchedAt: new Date().toISOString(), quote });
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get("/api/daily", async (req, res) => {
  const symbol = validSymbol(req.query.symbol);
  if (!symbol) return res.status(400).json({ error: "Provide a valid ticker symbol." });
  try {
    const data = await alphaVantage({ function: "TIME_SERIES_DAILY", symbol, outputsize: "compact" });
    const seriesKey = Object.keys(data).find(k => k.toLowerCase().includes("time series"));
    if (!seriesKey) return res.status(404).json({ error: "No daily prices returned for this symbol.", symbol });
    const series = data[seriesKey];
    const rows = Object.keys(series).sort().reverse().slice(0, 100).map(date => ({
      date,
      open: series[date]["1. open"],
      high: series[date]["2. high"],
      low: series[date]["3. low"],
      close: series[date]["4. close"],
      volume: series[date]["5. volume"]
    }));
    res.json({ symbol, source: "Alpha Vantage", fetchedAt: new Date().toISOString(), rows });
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get("/api/fundamentals", async (req, res) => {
  const symbol = validSymbol(req.query.symbol);
  if (!symbol) return res.status(400).json({ error: "Provide a valid ticker symbol." });
  const endpoints = [
    ["incomeStatement", "INCOME_STATEMENT"],
    ["balanceSheet", "BALANCE_SHEET"],
    ["cashFlow", "CASH_FLOW"]
  ];
  try {
    // Fetch separately so one unavailable endpoint does not erase successful results.
    const entries = await Promise.all(endpoints.map(async ([label, fn]) => {
      try {
        const data = await alphaVantage({ function: fn, symbol });
        const annual = Array.isArray(data.annualReports) ? data.annualReports : [];
        const quarterly = Array.isArray(data.quarterlyReports) ? data.quarterlyReports : [];
        if (!annual.length && !quarterly.length) {
          return [label, { available: false, message: "No statement records returned; check provider access and symbol coverage." }];
        }
        return [label, { available: true, source: "Alpha Vantage", annualReports: annual.slice(0, 5), quarterlyReports: quarterly.slice(0, 8) }];
      } catch (e) {
        return [label, { available: false, message: e.message }];
      }
    }));
    res.json({ symbol, source: "Alpha Vantage", fetchedAt: new Date().toISOString(), statements: Object.fromEntries(entries) });
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));

app.listen(PORT, () => {
  console.log(`AI Finance Lab running at http://localhost:${PORT}`);
});
