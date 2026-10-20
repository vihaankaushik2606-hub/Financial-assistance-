require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const AV_URL = "https://www.alphavantage.co/query";

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/config", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ supabaseUrl: SUPABASE_URL || null, supabaseAnonKey: SUPABASE_ANON_KEY || null, authConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) });
});

async function requireAuth(req, res, next) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(503).json({ error: "Accounts are not configured yet. Finish the Supabase setup in the deployment guide." });
  const match = /^Bearer\s+(.+)$/i.exec(req.get("authorization") || "");
  if (!match) return res.status(401).json({ error: "Please sign in to use the AI features." });
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${match[1]}` } });
    if (!response.ok) return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
    const user = await response.json();
    if (!user || typeof user.id !== "string") return res.status(401).json({ error: "Please sign in to use the AI features." });
    req.authUser = { id: user.id };
    next();
  } catch (_error) {
    return res.status(503).json({ error: "Could not verify your account right now. Please try again." });
  }
}

const aiRequestBuckets = new Map();
function limitAiRequests(req, res, next) {
  const key = req.authUser?.id || req.ip;
  const now = Date.now();
  const bucket = aiRequestBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > 60 * 60 * 1000) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1;
  aiRequestBuckets.set(key, bucket);
  if (bucket.count > 30) return res.status(429).json({ error: "AI usage limit reached for this account. Please try again later." });
  next();
}

function safeProviderError(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("rate limit") || text.includes("frequency") || text.includes("call frequency") || text.includes("limit reached")) {
    return "The market-data provider limit has been reached. Try again later or check your provider plan.";
  }
  if (text.includes("premium") || text.includes("entitlement") || text.includes("subscription")) {
    return "This market-data endpoint may require a paid provider entitlement.";
  }
  if (text.includes("invalid api key") || text.includes("apikey is invalid") || text.includes("api key")) {
    return "The market-data provider rejected its credentials. Check ALPHA_VANTAGE_API_KEY in Render environment settings.";
  }
  return "The market-data provider request failed. Check the Render logs and provider status.";
}

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
      const err = new Error(safeProviderError(data.Note || data.Information || data["Error Message"]));
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
  res.json({ ok: true, providerConfigured: Boolean(API_KEY), aiConfigured: Boolean(OPENAI_API_KEY), authConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY), service: "AI Finance Lab API" });
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


app.post("/api/ai-assist", requireAuth, limitAiRequests, async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: "AI assistant is not configured yet. Add OPENAI_API_KEY to your Render environment variables." });
  }
  const question = String(req.body?.question || "").trim();
  const context = String(req.body?.context || "").trim();
  if (!question) return res.status(400).json({ error: "Enter a question for the AI finance assistant." });
  if (question.length > 2000 || context.length > 6000) {
    return res.status(400).json({ error: "Please shorten your question or analysis context and try again." });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: "You are the AI Finance Lab educational finance research assistant. Explain financial concepts clearly, distinguish facts from assumptions, never claim fraud from ratios alone, never guarantee returns, and do not provide personalized investment recommendations. Encourage checking official filings and sources. Treat all user-provided company figures as unverified unless sourced.",
        input: `User question:\n${question}\n\nOptional analysis context (may be user-entered and unverified):\n${context || "No additional context provided."}`,
        max_output_tokens: 700
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) return res.status(502).json({ error: "The AI provider rejected the server credentials or access. Check OPENAI_API_KEY and project access in Render." });
      if (status === 429) return res.status(429).json({ error: "The AI service is rate-limited or its API usage quota is exhausted. Check your API usage and billing settings." });
      return res.status(502).json({ error: "The AI service could not complete this request. Check Render logs and the AI provider status." });
    }
    const answer = Array.isArray(data.output)
      ? data.output.flatMap(item => Array.isArray(item.content) ? item.content : []).filter(item => item.type === "output_text").map(item => item.text).join("\n").trim()
      : "";
    if (!answer) return res.status(502).json({ error: "The AI service returned no text. Please try again." });
    res.json({ answer });
  } catch (_error) {
    res.status(502).json({ error: "Could not reach the AI service. Please try again later." });
  }
});


app.post("/api/company-analysis", requireAuth, limitAiRequests, async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: "AI analysis is not configured. Add OPENAI_API_KEY to the Render environment." });
  }
  const company = String(req.body?.company || "").trim().slice(0, 120);
  if (!company) return res.status(400).json({ error: "Enter a company name or ticker symbol." });

  let providerContext = "No verified financial statements were retrieved from the market-data provider. Do not invent current figures.";
  let dataNote = "";
  const symbol = validSymbol(company);
  if (symbol) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.statements) {
        providerContext = JSON.stringify(data.statements).slice(0, 12000);
        dataNote = "Provider statement data was retrieved where available; each statement's availability message must be respected.";
      } else {
        dataNote = String(data.error || "Provider statements were unavailable.");
      }
    } catch (_error) {
      dataNote = "Could not retrieve provider statements.";
    }
  } else {
    dataNote = "Input is a company name rather than a ticker. No automatic symbol lookup is available, so no provider statements were retrieved.";
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: "You are an educational company-finance research assistant. Give a concise company overview, explain what the available evidence does and does not show, discuss profitability, cash flow, debt, and key risks only when supported by supplied data. Clearly label general background knowledge versus supplied provider data. Never invent current financial figures, prices, filings, or citations. If data is missing, say so and request the correct stock ticker or official annual report. Do not claim fraud from ratios alone, guarantee returns, or provide personalized investment recommendations. End with a short checklist of facts to verify from official filings.",
        input: `Analyze this company for an educational research report: ${company}\n\nProvider data status: ${dataNote}\n\nProvider statements (may be unavailable or incomplete):\n${providerContext}`,
        max_output_tokens: 900
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return res.status(502).json({ error: "The AI provider rejected the server credentials or access. Check OPENAI_API_KEY in Render." });
      if (response.status === 429) return res.status(429).json({ error: "The AI service is rate-limited or its API usage quota is exhausted." });
      return res.status(502).json({ error: "The AI service could not complete the analysis. Check Render logs." });
    }
    const answer = Array.isArray(data.output)
      ? data.output.flatMap(item => Array.isArray(item.content) ? item.content : []).filter(item => item.type === "output_text").map(item => item.text).join("\n").trim()
      : "";
    if (!answer) return res.status(502).json({ error: "The AI service returned no analysis. Please try again." });
    res.json({ company, answer, dataNote: dataNote || "Provider data status checked." });
  } catch (_error) {
    res.status(502).json({ error: "Could not reach the AI service. Please try again later." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));

app.listen(PORT, () => {
  console.log(`AI Finance Lab running at http://localhost:${PORT}`);
});
