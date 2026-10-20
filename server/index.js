require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FMP_API_KEY = process.env.FMP_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

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
    return "The market-data provider rejected its credentials. Check FMP_API_KEY in Render environment settings.";
  }
  return "The market-data provider request failed. Check the Render logs and provider status.";
}

function validSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  // Permit common ticker punctuation, while preventing arbitrary URL/input injection.
  if (!/^[A-Z0-9.^_-]{1,24}$/.test(symbol)) return null;
  return symbol;
}

// Cache FMP responses in memory to reduce repeated provider requests.
const providerCache = new Map();
const providerRequestsInFlight = new Map();
const CACHE_TTL_MS = {
  quote: 15 * 60 * 1000,
  "historical-price-eod/full": 6 * 60 * 60 * 1000,
  "income-statement": 24 * 60 * 60 * 1000,
  "balance-sheet-statement": 24 * 60 * 60 * 1000,
  "cash-flow-statement": 24 * 60 * 60 * 1000
};

async function fmpRequest(endpoint, params = {}) {
  if (!FMP_API_KEY) {
    const err = new Error("Market-data provider is not configured. Set FMP_API_KEY in Render environment settings.");
    err.status = 503;
    throw err;
  }
  const cacheKey = JSON.stringify({ endpoint, params });
  const cached = providerCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (providerRequestsInFlight.has(cacheKey)) return providerRequestsInFlight.get(cacheKey);

  const request = (async () => {
    const url = new URL(`${FMP_BASE_URL}/${endpoint}`);
    for (const [key, value] of Object.entries({ ...params, apikey: FMP_API_KEY })) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => null);
    if (!response.ok || (data && !Array.isArray(data) && (data["Error Message"] || data.error || data["Error"]))) {
      const detail = data?.["Error Message"] || data?.error || data?.["Error"] || `HTTP ${response.status}`;
      const err = new Error(safeProviderError(detail));
      err.status = response.status === 401 || response.status === 403 ? 502 : response.status === 429 ? 429 : 502;
      throw err;
    }
    if (data === null) {
      const err = new Error("The market-data provider returned an unreadable response.");
      err.status = 502;
      throw err;
    }
    const ttl = CACHE_TTL_MS[endpoint] || 60 * 60 * 1000;
    providerCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
    return data;
  })();
  providerRequestsInFlight.set(cacheKey, request);
  try { return await request; }
  finally { providerRequestsInFlight.delete(cacheKey); }
}

function fmpStatementRows(data) {
  return Array.isArray(data) ? data.slice(0, 8) : [];
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, providerConfigured: Boolean(FMP_API_KEY), aiConfigured: Boolean(OPENAI_API_KEY), authConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY), service: "AI Finance Lab API", marketDataProvider: "Financial Modeling Prep" });
});

app.get("/api/quote", async (req, res) => {
  const symbol = validSymbol(req.query.symbol);
  if (!symbol) return res.status(400).json({ error: "Provide a valid ticker symbol." });
  try {
    const data = await fmpRequest("quote", { symbol });
    const item = Array.isArray(data) ? data[0] : null;
    if (!item || item.price === undefined) return res.status(404).json({ error: "No quote returned for this symbol. Check symbol format, provider coverage, and your FMP plan.", symbol });
    const quote = {
      "01. symbol": item.symbol || symbol,
      "05. price": item.price,
      "06. volume": item.volume,
      "07. latest trading day": item.timestamp ? (Number.isFinite(Number(item.timestamp)) ? new Date(Number(item.timestamp) * 1000).toISOString().slice(0, 10) : String(item.timestamp).slice(0, 10)) : item.lastUpdated || null,
      "09. change": item.change,
      "10. change percent": item.changePercentage === undefined ? null : `${item.changePercentage}%`,
      raw: item
    };
    res.json({ symbol, source: "Financial Modeling Prep", fetchedAt: new Date().toISOString(), quote });
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get("/api/daily", async (req, res) => {
  const symbol = validSymbol(req.query.symbol);
  if (!symbol) return res.status(400).json({ error: "Provide a valid ticker symbol." });
  try {
    const data = await fmpRequest("historical-price-eod/full", { symbol });
    const historical = Array.isArray(data) ? data : Array.isArray(data?.historical) ? data.historical : [];
    if (!historical.length) return res.status(404).json({ error: "No daily prices returned for this symbol. Check FMP plan and symbol coverage.", symbol });
    const rows = historical.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 100).map(item => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume
    }));
    if (!rows.length) return res.status(404).json({ error: "No daily prices returned for this symbol.", symbol });
    res.json({ symbol, source: "Financial Modeling Prep", fetchedAt: new Date().toISOString(), rows });
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

app.get("/api/fundamentals", async (req, res) => {
  const symbol = validSymbol(req.query.symbol);
  if (!symbol) return res.status(400).json({ error: "Provide a valid ticker symbol." });
  const endpoints = [
    ["incomeStatement", "income-statement"],
    ["balanceSheet", "balance-sheet-statement"],
    ["cashFlow", "cash-flow-statement"]
  ];
  try {
    const entries = await Promise.all(endpoints.map(async ([label, endpoint]) => {
      try {
        const [annualResult, quarterlyResult] = await Promise.allSettled([
          fmpRequest(endpoint, { symbol, period: "annual", limit: 5 }),
          fmpRequest(endpoint, { symbol, period: "quarter", limit: 8 })
        ]);
        const annualReports = annualResult.status === "fulfilled" ? fmpStatementRows(annualResult.value) : [];
        const quarterlyReports = quarterlyResult.status === "fulfilled" ? fmpStatementRows(quarterlyResult.value) : [];
        if (!annualReports.length && !quarterlyReports.length) {
          const reason = annualResult.status === "rejected" ? annualResult.reason?.message : quarterlyResult.status === "rejected" ? quarterlyResult.reason?.message : "No statement records returned; check FMP plan and symbol coverage.";
          return [label, { available: false, message: reason || "No statement records returned." }];
        }
        return [label, { available: true, source: "Financial Modeling Prep", annualReports, quarterlyReports }];
      } catch (e) {
        return [label, { available: false, message: e.message }];
      }
    }));
    res.json({ symbol, source: "Financial Modeling Prep", fetchedAt: new Date().toISOString(), statements: Object.fromEntries(entries) });
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
