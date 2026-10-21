(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const fmt = (value, digits=2) => value === null || value === undefined || !Number.isFinite(Number(value)) ? "Unavailable" : Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});
  const pct = value => value === null || value === undefined ? "Unavailable" : fmt(value) + "%";
  const multiple = value => value === null || value === undefined ? "Unavailable" : fmt(value) + "x";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const metric = (label,value,detail="") => '<div class="metric"><div class="label">'+esc(label)+'</div><div class="value">'+esc(value)+'</div>'+(detail?'<div class="sub">'+esc(detail)+'</div>':"")+'</div>';
  let latestReport = null;
  const summaryMetrics = [
    ["Revenue", "revenue", "latest annual statement"],
    ["Revenue growth", "revenueGrowthPct", "year over year"],
    ["Net profit", "netIncome", "latest annual statement"],
    ["Net profit margin", "netProfitMarginPct", "net income ÷ revenue"],
    ["EBITDA", "ebitda", "if supplied by provider"],
    ["EBITDA margin", "ebitdaMarginPct", "EBITDA ÷ revenue"],
    ["Operating cash flow", "operatingCashFlow", "cash-flow statement"],
    ["Free cash flow", "freeCashFlow", "provider-reported or OCF less capex"]
  ];
  const valuationMetrics = [
    ["P/E (approx.)","peRatio","market cap ÷ latest annual net income"],
    ["Price / sales","priceToSales","market cap ÷ latest annual revenue"],
    ["Price / book","priceToBook","market cap ÷ latest reported equity"],
    ["EV / EBITDA","evToEbitda","enterprise value ÷ latest annual EBITDA"],
    ["Net debt","netDebt","total debt less cash"],
    ["Net debt / EBITDA","netDebtToEbitda","uses reported total debt and cash"],
    ["Debt / equity","debtToEquity","total debt ÷ equity"],
    ["Current ratio","currentRatio","current assets ÷ current liabilities"],
    ["Return on assets","returnOnAssetsPct","net income ÷ total assets"],
    ["Return on equity","returnOnEquityPct","net income ÷ equity"],
    ["Cash conversion","cashConversionPct","operating cash flow ÷ net income"],
    ["Share price","sharePrice","provider quote; currency may vary"]
  ];
  function renderTable(rows) {
    if (!rows || !rows.length) return '<p class="notice">No annual trend rows were returned. Check provider access and ticker coverage.</p>';
    const columns = [
      ["Year","year"],["Revenue","revenue"],["Revenue growth","revenueGrowthPct"],["Net income","netIncome"],["Net margin","netProfitMarginPct"],["EBITDA","ebitda"],["Operating cash flow","operatingCashFlow"],["Capex","capitalExpenditure"],["Free cash flow","freeCashFlow"],["Net debt","netDebt"]
    ];
    const years = rows.map((row,index) => ({...row, revenueGrowthPct:index+1<rows.length && row.revenue!==null && rows[index+1].revenue!==null && rows[index+1].revenue!==0 ? (row.revenue/rows[index+1].revenue-1)*100 : null}));
    return '<table><thead><tr>'+columns.map(c=>'<th>'+esc(c[0])+'</th>').join('')+'</tr></thead><tbody>'+years.map(row=>'<tr>'+columns.map(([label,key])=>'<td>'+esc(key==="year"?row[key]:key==="revenueGrowthPct"?pct(row[key]):(key==="netProfitMarginPct"?pct(row[key]):fmt(row[key])))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }
  function findings(report) {
    const m=report.metrics, list=[];
    if(m.revenueGrowthPct!==null) list.push([m.revenueGrowthPct>=0?"good":"warn","Revenue trend",m.revenueGrowthPct>=0?"Revenue grew versus the prior annual period. Check whether growth is organic and whether margins held up.":"Revenue declined versus the prior annual period. Investigate volumes, pricing, currency effects and business mix."]);
    if(m.netProfitMarginPct!==null) list.push([m.netProfitMarginPct>=10?"good":"warn","Net profit margin", "Calculated net profit margin is "+pct(m.netProfitMarginPct)+". Compare against this company's own history and relevant peers; sector economics differ."]);
    if(m.netIncomeGrowthPct!==null) list.push([m.netIncomeGrowthPct>=0?"good":"warn","Profit growth", "Net income changed "+pct(m.netIncomeGrowthPct)+" versus the prior annual period. Check one-off gains, taxes, financing costs and minority interests."]);
    if(m.netDebt!==null && m.ebitda!==null && m.ebitda>0 && m.netDebtToEbitda!==null) list.push([m.netDebtToEbitda<=2?"good":m.netDebtToEbitda<=4?"warn":"alert","Net debt / EBITDA",multiple(m.netDebtToEbitda)+" using retrieved statement fields. This simplified ratio is not a covenant calculation; verify debt definitions and maturities."]);
    if(m.operatingCashFlow!==null && m.netIncome!==null && m.netIncome>0 && m.operatingCashFlow<m.netIncome*.5) list.push(["warn","Cash conversion", "Operating cash flow is less than half of net income in the retrieved periods. Investigate working capital, non-cash items and seasonality."]);
    if(m.freeCashFlow!==null && m.freeCashFlow<0) list.push(["warn","Free cash flow", "Calculated/reported free cash flow is negative. Review investment cycle, capex timing and whether the provider's FCF definition matches your needs."]);
    if(!list.length) list.push(["warn","Limited evidence","There are not enough valid inputs to generate meaningful rule-based observations. Review the data-coverage notes below."]);
    return list.map(([kind,title,body])=>'<article class="finding '+kind+'"><b>'+esc(title)+'</b><p>'+esc(body)+'</p></article>').join('');
  }
  function render(report) {
    latestReport=report;
    const m=report.metrics||{};
    el("advancedSummary").innerHTML=summaryMetrics.map(([label,key,detail])=>metric(label,key==="revenueGrowthPct"||key==="netProfitMarginPct"||key==="ebitdaMarginPct"?pct(m[key]):fmt(m[key]),detail)).join("");
    el("advancedValuation").innerHTML=valuationMetrics.map(([label,key,detail])=>metric(label,["peRatio","priceToSales","priceToBook","evToEbitda","netDebtToEbitda","debtToEquity","currentRatio"].includes(key)?multiple(m[key]):(["returnOnAssetsPct","returnOnEquityPct","cashConversionPct"].includes(key)?pct(m[key]):fmt(m[key])),detail)).join("");
    el("advancedFindings").innerHTML=findings(report);
    el("advancedTrendTable").innerHTML=renderTable(report.trends);
    const availability=report.availability||{};
    const coverage=Object.entries(availability).map(([key,item])=>'<article class="finding '+(item.available?"good":"warn")+'"><b>'+esc(key.replace(/([A-Z])/g," $1"))+': '+(item.available?"Available":"Unavailable")+'</b><p>'+esc((item.annualPeriods||0)+" annual periods and "+(item.quarterlyPeriods||0)+" quarterly periods returned. "+(item.message||"Source: "+(item.source||"not supplied by provider")+".") )+'</p></article>');
    coverage.push('<article class="finding warn"><b>Segment analysis: unavailable</b><p>'+esc(report.segmentAnalysis?.message||"Segment financials were not returned by this endpoint.")+'</p></article>');
    coverage.push('<article class="finding"><b>Source and timestamp</b><p>'+esc("Source: "+(report.source||"unknown")+". Retrieved: "+(report.fetchedAt||"timestamp unavailable")+". Latest annual period: "+(report.latestPeriod||"unavailable")+". Prior period: "+(report.priorPeriod||"unavailable")+".")+'</p></article>');
    if(report.missingFields?.length) coverage.push('<article class="finding warn"><b>Missing calculated inputs</b><p>'+esc(report.missingFields.join(", "))+'</p></article>');
    (report.notes||[]).forEach(note=>coverage.push('<article class="finding"><p>'+esc(note)+'</p></article>'));
    el("advancedCoverage").innerHTML=coverage.join("");
    el("advancedStatus").textContent="Report loaded for "+report.symbol+". Latest statement period: "+(report.latestPeriod||"not supplied")+". Source: "+report.source+". Missing values are shown as unavailable; verify dates and currency.";
    el("advancedExportBtn").disabled=false;
  }
  async function analyze() {
    const symbol=el("advancedSymbol").value.trim().toUpperCase();
    if(!symbol){el("advancedStatus").textContent="Enter a ticker symbol first.";return;}
    if(!/^[A-Z0-9.^_-]{1,24}$/.test(symbol)){el("advancedStatus").textContent="Ticker contains unsupported characters.";return;}
    const button=el("advancedAnalyzeBtn"); button.disabled=true; el("advancedExportBtn").disabled=true;
    el("advancedStatus").textContent="Fetching statements and calculating ratios for "+symbol+"…";
    el("advancedSummary").innerHTML=""; el("advancedValuation").innerHTML=""; el("advancedFindings").innerHTML=""; el("advancedCoverage").innerHTML="";
    try {
      const response=await fetch("/api/analysis?symbol="+encodeURIComponent(symbol),{headers:{Accept:"application/json"}});
      const report=await response.json().catch(()=>({error:"The API returned an unreadable response."}));
      if(!response.ok) throw new Error(report.error||"Analysis request failed.");
      render(report);
    } catch(error) {
      el("advancedStatus").textContent="Could not generate report: "+(error.message||"Unknown error")+". Confirm the backend is deployed and FMP_API_KEY is configured.";
    } finally {button.disabled=false;}
  }
  el("advancedAnalyzeBtn").addEventListener("click",analyze);
  el("advancedSymbol").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();analyze();}});
  el("advancedExportBtn").addEventListener("click",()=>{
    if(!latestReport)return;
    const blob=new Blob([JSON.stringify(latestReport,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const anchor=document.createElement("a");
    anchor.href=url; anchor.download=(latestReport.symbol||"company")+"-financial-analysis.json";
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  });
})();