// Safe helpers in case script loads independently
const $ = (id) => (window.$ ? window.$(id) : document.getElementById(id));
const esc = (v) => (window.esc ? window.esc(v) : String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])));

const API_BASE_URL = "";

// Number formatting helpers
const fmt = (v, digits = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : "—";
};

const formatCompact = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

const formatPercent = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const prefix = n > 0 ? "+" : "";
  return `${prefix}${n.toFixed(2)}%`;
};

function metric(label, value, sub = "") {
  return `<div class="metric">
    <div class="label">${esc(label)}</div>
    <div class="value">${esc(value)}</div>
    ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
  </div>`;
}

async function api(path) {
  const r = await fetch(`${API_BASE_URL}${path}`);
  const d = await r.json().catch(() => ({ error: "The server returned an unreadable response." }));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}

async function checkHealth() {
  const statusEl = $("apiStatus");
  const dotEl = document.querySelector(".dot");
  if (!statusEl) return;

  try {
    const h = await api("/api/health");
    const fmpText = h.providerConfigured ? "Live FMP" : "Demo mode";
    const aiText = h.aiConfigured ? "AI ready" : "Key needed in .env";
    statusEl.textContent = `Online · ${fmpText} · ${aiText}`;
    if (dotEl) {
      dotEl.style.background = h.providerConfigured && h.aiConfigured ? "var(--green)" : "var(--amber)";
    }
  } catch {
    statusEl.textContent = "Backend connecting…";
    if (dotEl) dotEl.style.background = "var(--red)";
  }
}

const getSymbol = () => ($("symbol")?.value || "").trim().toUpperCase();
const quoteNumber = (v, digits = 2) => (v === null || v === undefined || v === "" ? "—" : fmt(v, digits));

// Quick ticker suggestion chips
function setupQuickTickers() {
  const container = document.getElementById("quickTickers");
  if (!container) return;
  const popular = ["AAPL", "MSFT", "NVDA", "IBM", "TSLA"];
  container.innerHTML = popular.map(t => `<button type="button" class="ticker-chip" data-ticker="${t}">${t}</button>`).join("");
  container.querySelectorAll(".ticker-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      if ($("symbol")) {
        $("symbol").value = btn.dataset.ticker;
        $("loadBtn")?.click();
      }
    });
  });
}

// 01 / Stock Quote Loader
$("loadBtn")?.addEventListener("click", async () => {
  const requestedSymbol = getSymbol();
  const messageEl = $("message");
  const loadBtn = $("loadBtn");
  const marketCards = $("marketCards");

  if (!requestedSymbol) {
    if (messageEl) messageEl.textContent = "Please enter a stock ticker (e.g. AAPL, MSFT, IBM).";
    return;
  }

  if (loadBtn) loadBtn.disabled = true;
  if (messageEl) messageEl.textContent = `Fetching market data for ${requestedSymbol}…`;
  if (marketCards) marketCards.innerHTML = "";

  try {
    const q = await api(`/api/quote?symbol=${encodeURIComponent(requestedSymbol)}`);
    const x = q.quote?.raw || {};
    const timestamp = x.timestamp ? new Date(Number(x.timestamp) * 1000) : null;
    const updated = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toLocaleString() : "Recent";
    const changePct = x.changePercentage !== undefined && x.changePercentage !== null ? formatPercent(x.changePercentage) : "—";
    const mktCap = x.marketCap ? formatCompact(x.marketCap) : "—";

    // Auto-populate revenue in manual scanner and scenario lab if available
    if (x.marketCap && !$("revenue")?.value) {
      const estimatedRev = Math.round(x.marketCap * 0.15);
      if ($("scenarioRevenue") && !$("scenarioRevenue").value) {
        $("scenarioRevenue").value = estimatedRev;
      }
    }

    if (marketCards) {
      marketCards.innerHTML = [
        metric("Company", x.name || "Unavailable", x.symbol || q.symbol),
        metric("Current Price", x.price !== undefined ? `$${quoteNumber(x.price)}` : "—", x.currency || "USD"),
        metric("Today's Change", `${quoteNumber(x.change)} (${changePct})`, x.change >= 0 ? "Gain" : "Loss"),
        metric("Market Cap", mktCap, "Valuation"),
        metric("Volume", x.volume ? Number(x.volume).toLocaleString() : "—", "Shares Traded"),
        metric("Day Range", `$${quoteNumber(x.dayLow)} – $${quoteNumber(x.dayHigh)}`, "Low – High"),
        metric("52-Week Range", `$${quoteNumber(x.yearLow)} – $${quoteNumber(x.yearHigh)}`, "52W Range"),
        metric("50-Day Moving Avg", quoteNumber(x.priceAvg50), "Short-term trend"),
        metric("200-Day Moving Avg", quoteNumber(x.priceAvg200), "Long-term trend"),
        metric("Previous Close", quoteNumber(x.previousClose), `Open: $${quoteNumber(x.open)}`),
        metric("Exchange", x.exchange || "US", `Updated: ${updated}`),
        metric("Data Source", q.source || "Market Provider", q.isDemo ? "Illustrative demo" : "Live feed")
      ].join("");
    }

    if (messageEl) {
      messageEl.textContent = q.isDemo
        ? `Showing demo data for ${x.symbol || q.symbol}. (Add your free FMP_API_KEY in .env to connect live market data.)`
        : `Live market quote loaded for ${x.symbol || q.symbol}. Data supplied by Financial Modeling Prep.`;
    }
  } catch (e) {
    if (messageEl) messageEl.textContent = `Could not load quote: ${e.message}`;
  } finally {
    if (loadBtn) loadBtn.disabled = false;
  }
});

$("symbol")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !$("loadBtn")?.disabled) {
    $("loadBtn")?.click();
  }
});

// Render financial statements into human-friendly cards and tables
function renderStatementTable(title, item) {
  if (!item.available) {
    return `
      <article class="statement">
        <b>${esc(title)}</b>
        <p class="notice" style="margin-top: 8px;">Notice: ${esc(item.message || "Data not available for this period.")}</p>
      </article>
    `;
  }

  const reports = item.annualReports || item.quarterlyReports || [];
  if (!reports.length) {
    return `
      <article class="statement">
        <b>${esc(title)}</b>
        <p class="muted" style="margin-top: 8px;">No records returned for this symbol.</p>
      </article>
    `;
  }

  // Build clean summary table for key metrics
  const headers = reports.slice(0, 4).map(r => r.calendarYear || r.date?.slice(0, 7) || "Period");
  
  // Extract key rows based on statement type
  let rows = [];
  if (reports[0].revenue !== undefined) {
    rows.push({ label: "Revenue", vals: reports.slice(0, 4).map(r => formatCompact(r.revenue)) });
    rows.push({ label: "Operating Income", vals: reports.slice(0, 4).map(r => formatCompact(r.operatingIncome)) });
    rows.push({ label: "Net Income", vals: reports.slice(0, 4).map(r => formatCompact(r.netIncome)) });
  } else if (reports[0].totalAssets !== undefined) {
    rows.push({ label: "Total Assets", vals: reports.slice(0, 4).map(r => formatCompact(r.totalAssets)) });
    rows.push({ label: "Cash & Equivalents", vals: reports.slice(0, 4).map(r => formatCompact(r.cashAndCashEquivalents)) });
    rows.push({ label: "Total Debt", vals: reports.slice(0, 4).map(r => formatCompact(r.totalDebt)) });
    rows.push({ label: "Stockholders Equity", vals: reports.slice(0, 4).map(r => formatCompact(r.totalStockholdersEquity)) });
  } else if (reports[0].operatingCashFlow !== undefined) {
    rows.push({ label: "Operating Cash Flow", vals: reports.slice(0, 4).map(r => formatCompact(r.operatingCashFlow)) });
    rows.push({ label: "Capital Expenditure", vals: reports.slice(0, 4).map(r => formatCompact(r.capitalExpenditure)) });
    rows.push({ label: "Free Cash Flow", vals: reports.slice(0, 4).map(r => formatCompact(r.freeCashFlow)) });
  }

  const tableHtml = `
    <div class="table-wrap" style="margin-top: 10px;">
      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Metric</th>
            ${headers.map(h => `<th>${esc(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="text-align: left; font-weight: 600;">${esc(r.label)}</td>
              ${r.vals.map(v => `<td>${esc(v)}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  return `
    <article class="statement">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <b style="font-size: 15px;">${esc(title)}</b>
        <span class="tag">${esc(item.source || "Financial Modeling Prep")}</span>
      </div>
      ${tableHtml}
      <details style="margin-top: 12px; font-size: 11px; color: var(--muted); cursor: pointer;">
        <summary>View raw JSON data</summary>
        <pre style="margin-top: 8px;">${esc(JSON.stringify(reports.slice(0, 2), null, 2))}</pre>
      </details>
    </article>
  `;
}

// Fundamentals Button
$("fundamentalsBtn")?.addEventListener("click", async () => {
  const requestedSymbol = getSymbol();
  const fundamentalsBtn = $("fundamentalsBtn");
  const messageEl = $("message");
  const outputEl = $("fundamentalsOutput");
  const sectionEl = $("fundamentalsSection");

  if (!requestedSymbol) {
    if (messageEl) messageEl.textContent = "Please enter a stock ticker first.";
    return;
  }

  if (fundamentalsBtn) fundamentalsBtn.disabled = true;
  if (messageEl) messageEl.textContent = "Retrieving financial statements…";
  if (outputEl) outputEl.innerHTML = "";
  if (sectionEl) sectionEl.hidden = false;

  try {
    const d = await api(`/api/fundamentals?symbol=${encodeURIComponent(requestedSymbol)}`);
    const labels = {
      incomeStatement: "Income Statement",
      balanceSheet: "Balance Sheet",
      cashFlow: "Cash Flow Statement"
    };

    if (outputEl) {
      outputEl.innerHTML = Object.entries(d.statements || {}).map(([key, item]) => {
        const title = labels[key] || key;
        return renderStatementTable(title, item);
      }).join("");
    }

    if (messageEl) {
      messageEl.textContent = d.isDemo
        ? `Showing demo statements for ${d.symbol}. (Add FMP_API_KEY in .env for live filings.)`
        : `Financial statements loaded for ${d.symbol}. Verify figures against official annual filings.`;
    }
  } catch (e) {
    if (outputEl) outputEl.innerHTML = `<p class="notice">${esc(e.message)}</p>`;
  } finally {
    if (fundamentalsBtn) fundamentalsBtn.disabled = false;
  }
});

// 02 / Automatic Company Analysis
const autoCompanyInput = $("autoCompany");
async function runAutomaticCompanyAnalysis() {
  const company = autoCompanyInput?.value.trim();
  const button = $("autoAnalyzeBtn");
  const outputEl = $("autoAnalysisOutput");
  const statusEl = $("autoAnalysisStatus");

  if (!company) {
    if (statusEl) statusEl.textContent = "Please enter a company name or ticker (e.g. Apple or AAPL).";
    return;
  }

  if (button) button.disabled = true;
  if (outputEl) outputEl.hidden = true;
  if (statusEl) statusEl.textContent = `Analyzing ${company} with educational AI…`;

  try {
    const token = typeof getAccessToken === "function" ? await getAccessToken() : "guest-token";
    const response = await fetch("/api/company-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ company })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Analysis could not be generated.");

    if (outputEl) {
      outputEl.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.7;">${esc(data.answer)}</div>`;
      outputEl.hidden = false;
    }

    if (typeof savePrivateHistory === "function") {
      await savePrivateHistory("company-analysis", `Analysis: ${company}`, data.answer);
    }

    if (statusEl) {
      statusEl.textContent = data.dataNote || "Analysis generated. Confirm important metrics against audited filings.";
    }
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message || "Automatic analysis failed.";
  } finally {
    if (button) button.disabled = false;
  }
}

$("autoAnalyzeBtn")?.addEventListener("click", runAutomaticCompanyAnalysis);
autoCompanyInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runAutomaticCompanyAnalysis();
  }
});

// 03 / Company Truth Scanner (Rule-Based Ratio Analyzer)
const num = (id) => {
  const el = $(id);
  if (!el) return null;
  const raw = el.value.trim();
  return raw === "" || isNaN(Number(raw)) ? null : Number(raw);
};

function fieldsForHistory() {
  return ["revenue", "expenses", "profit", "ocf", "debt", "cash", "priorRevenue", "priorProfit", "period"]
    .map(id => `${id}: ${$(id)?.value.trim() || "not entered"}`)
    .join("\n");
}

function calcRatios() {
  const revenue = num("revenue");
  const expenses = num("expenses");
  const profit = num("profit");
  const ocf = num("ocf");
  const debt = num("debt");
  const cash = num("cash");
  const priorRevenue = num("priorRevenue");
  const priorProfit = num("priorProfit");

  const out = [];
  if (revenue !== null && revenue > 0 && profit !== null) {
    out.push(metric("Net Profit Margin", `${fmt((profit / revenue) * 100)}%`, "Profit ÷ Revenue"));
  }
  if (revenue !== null && revenue > 0 && expenses !== null) {
    out.push(metric("Operating Expense Ratio", `${fmt((expenses / revenue) * 100)}%`, "Expenses ÷ Revenue"));
  }
  if (profit !== null && ocf !== null) {
    out.push(metric("Operating Cash Flow", formatCompact(ocf), "Compare with Net Profit"));
  }
  if (debt !== null && cash !== null) {
    out.push(metric("Net Debt", formatCompact(debt - cash), "Total Debt minus Cash"));
  }
  if (revenue > 0 && priorRevenue !== null && priorRevenue > 0) {
    const growth = ((revenue / priorRevenue) - 1) * 100;
    out.push(metric("Revenue Growth", formatPercent(growth), "Current vs Prior Period"));
  }
  if (profit !== null && priorProfit !== null && priorProfit !== 0) {
    const pChange = ((profit / priorProfit) - 1) * 100;
    out.push(metric("Profit Change", formatPercent(pChange), "Current vs Prior Period"));
  }

  if ($("ratioCards")) $("ratioCards").innerHTML = out.join("");

  const findings = [];
  if (profit !== null && ocf !== null && profit > 0 && ocf < 0) {
    findings.push([
      "alert",
      "⚠️ Positive Accounting Profit but Negative Cash Flow",
      "Operating cash flow is negative despite positive accounting profit. Investigate changes in accounts receivable, inventory accumulation, or one-time gains."
    ]);
  }
  if (profit !== null && ocf !== null && profit > 0 && ocf >= 0 && ocf < profit * 0.5) {
    findings.push([
      "warn",
      "⚠️ Cash Flow Trails Net Profit Significantly",
      "Operating cash flow is less than half of net income. Check working capital changes and non-cash accounting accruals."
    ]);
  }
  if (debt !== null && cash !== null && debt > cash * 3) {
    findings.push([
      "warn",
      "Debt Exceeds Cash by More than 3x",
      "Total debt is substantially higher than cash reserves. Check maturity schedules, interest coverage ratio, and refinance risks."
    ]);
  }
  if (revenue > 0 && expenses !== null && expenses > revenue) {
    findings.push([
      "warn",
      "Operating Expenses Exceed Revenue",
      "Operating costs exceed incoming revenue. Verify if this includes non-operating or non-recurring charges."
    ]);
  }
  if (revenue > 0 && priorRevenue !== null && priorRevenue > 0 && profit !== null && priorProfit !== null && revenue > priorRevenue && profit < priorProfit) {
    findings.push([
      "warn",
      "Revenue Expanded while Profit Contracted",
      "Top-line growth with margin compression. Check gross margins, input cost inflation, or increased operating spend."
    ]);
  }
  if (revenue > 0 && priorRevenue !== null && priorRevenue > 0 && profit !== null && priorProfit !== null && revenue < priorRevenue && profit > priorProfit) {
    findings.push([
      "warn",
      "Profit Rose while Revenue Contracted",
      "Profit grew despite lower sales. Check cost-cutting measures, asset disposals, or tax benefits in footnotes."
    ]);
  }
  if (!findings.length) {
    findings.push([
      "good",
      "✅ No High-Risk Patterns Flagged",
      "Calculated metrics fit standard ranges for the entered period. Remember to compare across multiple years and peer companies."
    ]);
  }

  if ($("findings")) {
    $("findings").innerHTML = findings.map(([kind, title, body]) => `
      <article class="finding ${kind}">
        <b>${esc(title)}</b>
        <p>${esc(body)}</p>
      </article>
    `).join("");
  }

  const period = $("period")?.value.trim() || "";
  if ($("manualSource")) {
    $("manualSource").textContent = `Source status: user-entered figures. ${period ? `Reporting period / source: ${period}.` : "Add a reporting period/source for clear attribution."} Ratios are only valid when currency and accounting standards match.`;
  }

  if (typeof savePrivateHistory === "function") {
    savePrivateHistory("manual-analysis", "Company Truth Scan", `${fieldsForHistory()}\n\n${$("findings")?.innerText || ""}`);
  }
}

$("scanBtn")?.addEventListener("click", calcRatios);

$("aiContextBtn")?.addEventListener("click", () => {
  const fields = [
    ["Revenue", "revenue"], ["Operating expenses", "expenses"], ["Net profit", "profit"],
    ["Operating cash flow", "ocf"], ["Total debt", "debt"], ["Cash and equivalents", "cash"],
    ["Prior-period revenue", "priorRevenue"], ["Prior-period net profit", "priorProfit"],
    ["Reporting period/source", "period"]
  ];
  const context = fields.map(([label, id]) => {
    const value = $(id)?.value.trim();
    return value ? `${label}: ${value}` : null;
  }).filter(Boolean).join("\n");

  if ($("aiQuestion")) {
    $("aiQuestion").value = $("aiQuestion").value.trim() || "Explain these financial figures and highlight what questions I should check in the official SEC filings.";
    $("aiQuestion").dataset.context = context;
  }
  if ($("aiStatus")) {
    $("aiStatus").textContent = context
      ? "Scanner values attached to your next question (unverified user inputs)."
      : "No figures entered in the scanner yet. You can still ask any finance question!";
  }
});

// 04 / AI Assistant
$("aiAskBtn")?.addEventListener("click", async () => {
  const question = $("aiQuestion")?.value.trim();
  const button = $("aiAskBtn");
  const answerEl = $("aiAnswer");
  const statusEl = $("aiStatus");

  if (!question) {
    if (statusEl) statusEl.textContent = "Please enter a finance question first.";
    return;
  }

  if (button) button.disabled = true;
  if (answerEl) answerEl.hidden = true;
  if (statusEl) statusEl.textContent = "Consulting AI research assistant…";

  try {
    const token = typeof getAccessToken === "function" ? await getAccessToken() : "guest-token";
    const response = await fetch("/api/ai-assist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        question,
        context: $("aiQuestion")?.dataset.context || ""
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "AI request failed.");

    if (answerEl) {
      answerEl.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.7;">${esc(data.answer)}</div>`;
      answerEl.hidden = false;
    }

    if (typeof savePrivateHistory === "function") {
      await savePrivateHistory("ai-assistant", `Question: ${question}`, data.answer);
    }

    if (statusEl) {
      statusEl.textContent = "AI response received. Always verify claims against official filings.";
    }
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message || "Could not reach the AI assistant.";
  } finally {
    if (button) button.disabled = false;
  }
});

$("clearBtn")?.addEventListener("click", () => {
  ["revenue", "expenses", "profit", "ocf", "debt", "cash", "priorRevenue", "priorProfit", "period"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  if ($("ratioCards")) $("ratioCards").innerHTML = "";
  if ($("findings")) $("findings").innerHTML = '<p class="muted">Enter figures and run the scanner to see calculated ratios and research prompts.</p>';
  if ($("manualSource")) $("manualSource").textContent = "Source status: figures have not been entered.";
});

// 05 / Scenario Lab
$("scenarioBtn")?.addEventListener("click", () => {
  // Check direct scenario input first, then fall back to manual revenue input
  let revenue = num("scenarioRevenue");
  if (revenue === null || revenue <= 0) {
    revenue = num("revenue");
  }

  const scenarioCards = $("scenarioCards");
  if (!scenarioCards) return;

  if (revenue === null || revenue <= 0) {
    scenarioCards.innerHTML = metric("Revenue Required", "Enter revenue above or in the manual scanner (Revenue field) to project scenarios.");
    return;
  }

  const cases = [
    ["Bear Case", "bearGrowth", "bearMargin"],
    ["Base Case", "baseGrowth", "baseMargin"],
    ["Bull Case", "bullGrowth", "bullMargin"]
  ];

  scenarioCards.innerHTML = cases.map(([name, g, m]) => {
    const growth = num(g) || 0;
    const margin = num(m) || 0;
    const projectedRevenue = revenue * (1 + growth / 100);
    const projectedProfit = projectedRevenue * (margin / 100);

    return metric(
      name,
      `Profit: ${formatCompact(projectedProfit)}`,
      `Projected Revenue: ${formatCompact(projectedRevenue)} · Growth: ${formatPercent(growth)} · Margin: ${margin.toFixed(1)}%`
    );
  }).join("");
});

// Initialize on load
checkHealth();
setupQuickTickers();
