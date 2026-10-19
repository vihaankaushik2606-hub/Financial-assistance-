const $ = (id) => document.getElementById(id);
const API_BASE_URL = ""; // Same-origin backend. Change only if deploying frontend separately.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmt = (v, digits=2) => Number.isFinite(Number(v)) ? Number(v).toLocaleString(undefined,{maximumFractionDigits:digits}) : "—";
const moneyish = (v) => fmt(v);
function metric(label, value, sub="") {
  return `<div class="metric"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>${sub?`<div class="sub">${esc(sub)}</div>`:""}</div>`;
}
async function api(path) {
  const r = await fetch(`${API_BASE_URL}${path}`);
  const d = await r.json().catch(()=>({error:"The API returned a non-JSON response."}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}
async function checkHealth() {
  try {
    const h = await api("/api/health");
    $("apiStatus").textContent = `Backend online · Market data: ${h.providerConfigured ? "ready" : "key missing"} · ChatGPT: ${h.aiConfigured ? "ready" : "key needed"}`;
    document.querySelector(".dot").style.background = h.providerConfigured && h.aiConfigured ? "var(--green)" : "var(--amber)";
  } catch {
    $("apiStatus").textContent = "Backend unavailable";
    document.querySelector(".dot").style.background = "var(--red)";
  }
}
const symbol = () => $("symbol").value.trim().toUpperCase();
$("loadBtn").addEventListener("click", async () => {
  if (!symbol()) return $("message").textContent = "Enter a ticker symbol first.";
  $("loadBtn").disabled = true;
  $("message").textContent = "Requesting quote and daily prices…";
  $("marketCards").innerHTML = ""; $("historySection").hidden = true;
  try {
    const [q,d] = await Promise.all([api(`/api/quote?symbol=${encodeURIComponent(symbol())}`),api(`/api/daily?symbol=${encodeURIComponent(symbol())}`)]);
    const x = q.quote || {}, rows = d.rows || [];
    $("marketCards").innerHTML = [
      metric("Ticker",q.symbol,"Source: Alpha Vantage"),
      metric("Latest available price",x["05. price"] || "Unavailable", "Provider quote; not guaranteed real-time"),
      metric("Change",x["09. change"] || "—",x["10. change percent"] || ""),
      metric("Latest trading day",x["07. latest trading day"] || rows[0]?.date || "—"),
      metric("Volume",x["06. volume"] || rows[0]?.volume || "—"),
      metric("Fetched at",new Date(q.fetchedAt).toLocaleString(),"Provider data can be delayed")
    ].join("");
    $("historyRows").innerHTML = rows.slice(0,20).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.open)}</td><td>${esc(r.high)}</td><td>${esc(r.low)}</td><td>${esc(r.close)}</td><td>${esc(r.volume)}</td></tr>`).join("");
    $("historySection").hidden = false;
    $("message").textContent = "Market data fetched. Verify the symbol, currency, trading date, and provider terms before relying on it.";
  } catch(e) { $("message").textContent = `Could not fetch market data: ${e.message}`; }
  finally { $("loadBtn").disabled = false; }
});
$("fundamentalsBtn").addEventListener("click", async () => {
  if (!symbol()) return $("message").textContent = "Enter a ticker symbol first.";
  $("fundamentalsBtn").disabled = true;
  $("message").textContent = "Requesting company statements…";
  $("fundamentalsOutput").innerHTML = ""; $("fundamentalsSection").hidden = false;
  try {
    const d = await api(`/api/fundamentals?symbol=${encodeURIComponent(symbol())}`);
    $("fundamentalsOutput").innerHTML = Object.entries(d.statements || {}).map(([name,item]) => {
      const content = item.available
        ? `<p class="notice">Available · Source: ${esc(item.source)} · ${esc(d.fetchedAt)}</p><pre>${esc(JSON.stringify({annualReports:item.annualReports,quarterlyReports:item.quarterlyReports},null,2))}</pre>`
        : `<p class="notice">Unavailable: ${esc(item.message)}</p>`;
      return `<article class="statement"><b>${esc(name.replace(/([A-Z])/g," $1"))}</b>${content}</article>`;
    }).join("");
    $("message").textContent = "Statement endpoints checked. Some providers require a paid entitlement or may not cover this ticker.";
  } catch(e) { $("fundamentalsOutput").innerHTML = `<p class="notice">${esc(e.message)}</p>`; }
  finally { $("fundamentalsBtn").disabled = false; }
});

const num = id => { const raw = $(id).value.trim(); return raw === "" ? null : Number(raw); };
function calcRatios() {
  const revenue=num("revenue"), expenses=num("expenses"), profit=num("profit"), ocf=num("ocf"), debt=num("debt"), cash=num("cash");
  const priorRevenue=num("priorRevenue"), priorProfit=num("priorProfit");
  const out=[];
  if (revenue !== null && revenue > 0 && profit !== null) out.push(metric("Net profit margin",`${fmt(profit/revenue*100)}%`,"Net profit ÷ revenue"));
  if (revenue !== null && revenue > 0 && expenses !== null) out.push(metric("Expense ratio",`${fmt(expenses/revenue*100)}%`,"Operating expenses ÷ revenue"));
  if (profit !== null && ocf !== null) out.push(metric("Operating cash flow",moneyish(ocf),"Compare with profit across matching periods"));
  if (debt !== null && cash !== null) out.push(metric("Net debt",moneyish(debt-cash),"Debt minus cash; same units required"));
  if (revenue > 0 && priorRevenue !== null && priorRevenue > 0) out.push(metric("Revenue growth",`${fmt((revenue/priorRevenue-1)*100)}%`,"Current vs prior period"));
  if (profit !== null && priorProfit !== null && priorProfit !== 0) out.push(metric("Profit change",`${fmt((profit/priorProfit-1)*100)}%`,"Current vs prior period"));
  $("ratioCards").innerHTML = out.join("");
  const findings=[];
  if (profit !== null && ocf !== null && profit > 0 && ocf < 0) findings.push(["alert","Positive profit but negative operating cash flow","Investigate working capital, receivables, one-off items, and cash-flow statement notes. This pattern is a prompt, not proof of misconduct."]);
  if (profit !== null && ocf !== null && profit > 0 && ocf >= 0 && ocf < profit*.5) findings.push(["warn","Cash flow materially below profit","Check whether this is temporary, seasonal, or driven by working capital and non-cash accounting items."]);
  if (debt !== null && cash !== null && debt > cash*3) findings.push(["warn","Debt substantially exceeds cash","Review maturity schedule, interest costs, covenants, and operating cash generation."]);
  if (revenue > 0 && expenses !== null && expenses > revenue) findings.push(["warn","Entered expenses exceed revenue","Check whether expenses use the same period and definition as revenue."]);
  if (revenue > 0 && priorRevenue !== null && priorRevenue > 0 && profit !== null && priorProfit !== null && revenue > priorRevenue && profit < priorProfit) findings.push(["warn","Revenue rose while profit fell","Investigate margin pressure, higher costs, financing costs, and exceptional items."]);
  if (revenue > 0 && priorRevenue !== null && priorRevenue > 0 && profit !== null && priorProfit !== null && revenue < priorRevenue && profit > priorProfit) findings.push(["warn","Profit rose while revenue fell","Check one-off gains, cost cuts, asset sales, and accounting notes."]);
  if (!findings.length) findings.push(["good","No configured pattern flagged","This does not establish that a company is financially healthy. Review filings, peer data, footnotes, and multiple periods."]);
  $("findings").innerHTML = findings.map(([kind,title,body])=>`<article class="finding ${kind}"><b>${esc(title)}</b><p>${esc(body)}</p></article>`).join("");
  const period=$("period").value.trim();
  $("manualSource").textContent = `Source status: user-entered figures, not independently verified. ${period ? `Provided reporting period/source: ${period}.` : "Add a reporting period and source URL/reference before sharing this report."} Ratios are only comparable when definitions, currency, and periods match.`;
}
$("scanBtn").addEventListener("click",calcRatios);

$("aiContextBtn").addEventListener("click", () => {
  const fields = [
    ["Revenue", "revenue"], ["Operating expenses", "expenses"], ["Net profit", "profit"],
    ["Operating cash flow", "ocf"], ["Total debt", "debt"], ["Cash and equivalents", "cash"],
    ["Prior-period revenue", "priorRevenue"], ["Prior-period net profit", "priorProfit"],
    ["Reporting period/source", "period"]
  ];
  const context = fields.map(([label,id]) => {
    const value = $(id).value.trim();
    return value ? `${label}: ${value}` : null;
  }).filter(Boolean).join("\n");
  $("aiQuestion").value = $("aiQuestion").value.trim() || "Explain these figures and identify what I should verify in the company's official filings.";
  $("aiQuestion").dataset.context = context;
  $("aiStatus").textContent = context ? "Scanner values attached to the next AI request (not independently verified)." : "No scanner values entered yet. You can still ask a general finance question.";
});

$("aiAskBtn").addEventListener("click", async () => {
  const question = $("aiQuestion").value.trim();
  if (!question) {
    $("aiStatus").textContent = "Enter a finance question first.";
    return;
  }
  const button = $("aiAskBtn");
  button.disabled = true;
  $("aiAnswer").hidden = true;
  $("aiStatus").textContent = "Asking the AI assistant…";
  try {
    const response = await fetch("/api/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context: $("aiQuestion").dataset.context || "" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The AI request failed.");
    $("aiAnswer").textContent = data.answer;
    $("aiAnswer").hidden = false;
    $("aiStatus").textContent = "AI response received. Verify important claims against official filings and reliable sources.";
  } catch (error) {
    $("aiStatus").textContent = error.message || "Could not reach the AI assistant.";
  } finally {
    button.disabled = false;
  }
});
$("clearBtn").addEventListener("click",()=>{
  ["revenue","expenses","profit","ocf","debt","cash","priorRevenue","priorProfit","period"].forEach(id=>$(id).value="");
  $("ratioCards").innerHTML=""; $("findings").innerHTML='<p class="muted">Enter figures and run the scanner to see calculated ratios and research prompts.</p>';
  $("manualSource").textContent="Source status: figures have not been entered.";
});
$("scenarioBtn").addEventListener("click",()=>{
  const revenue=num("revenue");
  if (revenue===null || revenue<=0) { $("scenarioCards").innerHTML=metric("Scenario unavailable","Enter current-period revenue first."); return; }
  const cases=[["Bear","bearGrowth","bearMargin"],["Base","baseGrowth","baseMargin"],["Bull","bullGrowth","bullMargin"]];
  $("scenarioCards").innerHTML=cases.map(([name,g,m])=>{
    const growth=num(g)||0, margin=num(m)||0, projectedRevenue=revenue*(1+growth/100), projectedProfit=projectedRevenue*margin/100;
    return metric(`${name} case profit`,fmt(projectedProfit),`Revenue ${fmt(projectedRevenue)} · Growth ${fmt(growth)}% · Margin ${fmt(margin)}%`);
  }).join("");
});
checkHealth();
