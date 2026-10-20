const $ = (id) => document.getElementById(id);
const API_BASE_URL = ""; // Same-origin backend. Change only if deploying frontend separately.

let supabaseClient = null;
let currentSession = null;
async function initAccount() {
  const setup = $("authSetupNotice");
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const config = await response.json();
    if (!config.authConfigured || !window.supabase?.createClient) {
      setup.textContent = "Accounts are not configured yet. The site owner must add SUPABASE_URL and SUPABASE_ANON_KEY in Render, then complete the database setup in the project README.";
      $("authStatus").textContent = "AI features are protected and require a configured, signed-in account.";
      return;
    }
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    setup.textContent = "Account service ready. Sign in to use AI and view your own saved history.";
    const { data } = await supabaseClient.auth.getSession();
    currentSession = data.session;
    renderAccount(currentSession);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      renderAccount(session);
    });
  } catch (_error) {
    setup.textContent = "Could not load account setup. Please try again later.";
  }
}
function renderAccount(session) {
  $("authSignedOut").hidden = Boolean(session);
  $("authSignedIn").hidden = !session;
  if (session) {
    $("accountIdentity").textContent = `Signed in as ${session.user.email || "Google account"}`;
    $("authStatus").textContent = "Signed in. AI requests and history are associated with this account.";
    loadPrivateHistory();
  } else {
    $("authStatus").textContent = "Sign in to use AI features and save your private history.";
    $("historyList").innerHTML = '<p class="muted">Sign in to view your saved analyses.</p>';
  }
}
async function getAccessToken() {
  if (!supabaseClient) throw new Error("Account service is not configured yet.");
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Please sign in before using AI features.");
  return data.session.access_token;
}
async function savePrivateHistory(kind, title, content) {
  if (!supabaseClient || !currentSession) return;
  const { error } = await supabaseClient.from("analysis_history").insert({
    kind, title: String(title || "").slice(0, 160), content: String(content || "").slice(0, 12000)
  });
  if (error) {
    $("authStatus").textContent = "The AI answer was received, but could not be saved. Check the database setup in the README.";
    return;
  }
  await loadPrivateHistory();
}
async function loadPrivateHistory() {
  if (!supabaseClient || !currentSession) return;
  $("historyList").innerHTML = '<p class="muted">Loading your saved history…</p>';
  const { data, error } = await supabaseClient.from("analysis_history")
    .select("id,kind,title,content,created_at")
    .order("created_at", { ascending: false }).limit(30);
  if (error) {
    $("historyList").innerHTML = '<p class="notice">History table is not ready yet. The site owner must run the SQL setup in the README.</p>';
    return;
  }
  if (!data?.length) {
    $("historyList").innerHTML = '<p class="muted">No saved AI analyses yet. Your future AI results will appear here.</p>';
    return;
  }
  $("historyList").innerHTML = data.map(item => `<article class="finding"><time>${esc(new Date(item.created_at).toLocaleString())} · ${esc(item.kind)}</time><b>${esc(item.title)}</b><p>${esc(item.content)}</p></article>`).join("");
}
async function runAuthAction(action) {
  if (!supabaseClient) {
    $("authStatus").textContent = "Accounts are not configured. The site owner must finish the Supabase setup first.";
    return;
  }
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  $("authStatus").textContent = "Working…";
  try {
    let result;
    if (action === "signup") {
      if (!email || password.length < 8) throw new Error("Enter a valid email and a password with at least 8 characters.");
      result = await supabaseClient.auth.signUp({ email, password });
      if (result.error) throw result.error;
      $("authStatus").textContent = result.data.session ? "Account created and signed in." : "Account created. Check your email to confirm it, then sign in.";
    } else if (action === "signin") {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      $("authStatus").textContent = "Signed in successfully.";
    } else if (action === "google") {
      result = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (result.error) throw result.error;
    } else if (action === "signout") {
      result = await supabaseClient.auth.signOut();
      if (result.error) throw result.error;
      $("authStatus").textContent = "You have signed out.";
    }
  } catch (error) {
    $("authStatus").textContent = error.message || "Account action failed. Please try again.";
  }
}
$("signInBtn").addEventListener("click", () => runAuthAction("signin"));
$("signUpBtn").addEventListener("click", () => runAuthAction("signup"));
$("googleSignInBtn").addEventListener("click", () => runAuthAction("google"));
$("signOutBtn").addEventListener("click", () => runAuthAction("signout"));
$("refreshHistoryBtn").addEventListener("click", loadPrivateHistory);
initAccount();
\nconst esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
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


const autoCompanyInput = $("autoCompany");
let autoAnalysisTimer = null;
async function runAutomaticCompanyAnalysis() {
  const company = autoCompanyInput.value.trim();
  if (!company) return;
  const button = $("autoAnalyzeBtn");
  button.disabled = true;
  $("autoAnalysisOutput").hidden = true;
  $("autoAnalysisStatus").textContent = `Researching ${company}…`;
  try {
    const response = await fetch("/api/company-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Automatic analysis failed.");
    $("autoAnalysisOutput").textContent = data.answer;
    $("autoAnalysisOutput").hidden = false;
    $("autoAnalysisStatus").textContent = data.dataNote || "Analysis complete. Verify important figures against official company filings.";
  } catch (error) {
    $("autoAnalysisStatus").textContent = error.message || "Automatic analysis failed.";
  } finally {
    button.disabled = false;
  }
}
$("autoAnalyzeBtn").addEventListener("click", runAutomaticCompanyAnalysis);
autoCompanyInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (autoAnalysisTimer) clearTimeout(autoAnalysisTimer);
    runAutomaticCompanyAnalysis();
  }
});
autoCompanyInput.addEventListener("change", () => {
  if (autoAnalysisTimer) clearTimeout(autoAnalysisTimer);
  autoAnalysisTimer = setTimeout(runAutomaticCompanyAnalysis, 300);
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
