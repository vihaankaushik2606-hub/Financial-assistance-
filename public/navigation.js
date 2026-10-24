(() => {
 // The landing page uses a single compact header; other pages keep quick navigation.
 if (document.body.classList.contains('landing-market-page') || document.body.classList.contains('floating-subpage')) {
  const strip = document.querySelector('.quick-nav');
  const profile = strip?.querySelector('.profile-link');
  const header = document.querySelector('.site-header nav,.subpage-header-nav');
  if (profile && header) { header.appendChild(profile); strip.remove(); }
 }
 const box = document.getElementById('reduceMotion');
 let reduced = false;
 try { reduced = localStorage.getItem('finance-reduce-motion') === 'true'; } catch (_) {}
 document.documentElement.classList.toggle('reduce-motion', reduced);
 if (box) {
  box.checked = reduced;
  box.addEventListener('change', () => {
   document.documentElement.classList.toggle('reduce-motion', box.checked);
   try { localStorage.setItem('finance-reduce-motion', String(box.checked)); document.getElementById('settingsStatus').textContent = 'Preference saved on this device.'; }
   catch (_) { document.getElementById('settingsStatus').textContent = 'Preference applied for this page. Your browser could not save it.'; }
  });
 }
 function markCurrent() {
  document.querySelectorAll('.quick-nav a,.subpage-header-nav a').forEach(link => {
   const url = new URL(link.href);
   const active = url.pathname === location.pathname && (url.hash ? url.hash === location.hash : !location.hash);
   if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
 }
 markCurrent(); window.addEventListener('hashchange', markCurrent);
})();
(() => {const nav=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(nav&&!nav.querySelector('a[href="/research-lab.html"]')){const a=document.createElement("a");a.href="/research-lab.html";a.textContent="Business Analysis Lab";if(location.pathname==="/research-lab.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{const n=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(n&&!n.querySelector('a[href="/news.html"]')){const a=document.createElement("a");a.href="/news.html";a.textContent="News";n.append(a);}})();
(()=>{const main=document.querySelector('main');if(main&&!document.querySelector('.workspace-nav')){const n=document.createElement('nav');n.className='workspace-nav';n.setAttribute('aria-label','Research tools');for(const [href,label] of [['/evidence.html','Evidence Review'],['/quarterly.html','Quarterly Changes'],['/news-impact.html','News Impact'],['/my-research.html','My Analysis']]){const a=document.createElement('a');a.href=href;a.textContent=label;n.append(a);}main.append(n);}})();
(() => {
 const header=document.querySelector('.site-header,.topbar');if(!header)return;
 let account=header.querySelector('.profile-link')||header.querySelector('a[href="/account.html"]');
 if(!account){account=document.createElement('a');account.href='/account.html';}
 header.querySelectorAll('a[href="/account.html"]').forEach(a=>{if(a!==account)a.remove();});
 account.classList.add('profile-link','header-account');account.setAttribute('aria-label','Your account / sign in');account.title='Your account';
 if(!account.querySelector('svg'))account.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
 header.append(account);
})();

document.documentElement.classList.remove("sign-in-hidden");

(()=>{const nav=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(nav&&!nav.querySelector('a[href="/financial-instruments.html"]')){const a=document.createElement("a");a.href="/financial-instruments.html";a.textContent="Instruments";if(location.pathname==="/financial-instruments.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{for(const nav of document.querySelectorAll(".workspace-nav")){if(nav.querySelector('a[href="/compare-health.html"]'))continue;const a=document.createElement("a");a.href="/compare-health.html";a.textContent="Compare & Health";if(location.pathname==="/compare-health.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{const nav=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(nav&&!nav.querySelector('a[href="/pricing.html"]')){const a=document.createElement("a");a.href="/pricing.html";a.textContent="Pricing";if(location.pathname==="/pricing.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{const main=document.querySelector("main");if(main&&!document.querySelector('[data-source-credit]')){const p=document.createElement("p");p.dataset.sourceCredit="true";p.style.cssText="text-align:center;padding:2rem 1rem;font-size:.9rem";const a=document.createElement("a");a.href="/sources.html";a.textContent="Sources & credits · CNBC · TradingView · FMP";p.append(a);main.append(p);}})();

(()=>{for(const n of document.querySelectorAll(".workspace-nav")){if(n.querySelector('a[href="/company-evaluation.html"]'))continue;const a=document.createElement("a");a.href="/company-evaluation.html";a.textContent="Company Evaluation";if(location.pathname==="/company-evaluation.html")a.setAttribute("aria-current","page");n.append(a);}})();

(()=>{const nav=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(nav&&!nav.querySelector('a[href="/company-evaluation.html"]')){const a=document.createElement("a");a.href="/company-evaluation.html";a.textContent="Company Evaluation";if(location.pathname==="/company-evaluation.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{const nav=document.querySelector(".site-header nav,.subpage-header-nav");const link=nav?.querySelector('a[href="/company-evaluation.html"]');if(!link)return;link.style.setProperty("display","inline-flex","important");nav.style.flexWrap="wrap";const header=nav.closest("header");if(header)header.style.flexWrap="wrap";})();


(() => {
"use strict";
const page=location.pathname.split("/").pop(),$=id=>document.getElementById(id);
const topics={
"dashboard.html":["Stock analysis","Connect the company’s sales, profit, cash generation and debt. A price chart shows market prices; it does not explain the business or establish its value."],
"research-lab.html":["Business analysis","Start with what the company sells, who pays it and its main costs. Connect the reported figures to evidence, risks and your own conclusion."],
"company-evaluation.html":["Company evaluation","Review the business model, profitability, cash generation, debt, governance and competition together. Review markers record your work, not a company rating."],
"compare-health.html":["Comparison and financial patterns","Compare reporting periods, currencies and business models before comparing figures. Warning patterns identify questions to investigate; they do not prove misconduct or rank stocks."],
"quarterly.html":["Quarterly changes","Compare sales, profit, margins, cash and debt across matching quarters. A change describes what happened; seasonality, one-off items and accounting policies may affect the explanation."],
"evidence.html":["Evidence review","Trace each observation to its figure, reporting date and calculation. An AI citation points to supplied evidence; verify the original filing before accepting the conclusion."],
"news-impact.html":["News impact","Separate the reported event from your interpretation. Explain how it could affect demand, costs, cash, debt or regulation, and record which assumption changed."],
"news.html":["Finance and stock news","Read the dated source article before drawing conclusions. A headline or excerpt gives context, not a complete company analysis."],
"financial-instruments.html":["Financial instruments","Understand how each instrument works, how returns arise, what can cause losses and how liquidity, fees and obligations differ."]
};
if(!topics[page])return;
const main=document.querySelector("main");if(!main)return;
const intro=document.createElement("section");intro.className="analysis-summary";
intro.style.cssText="background:transparent;border:0;box-shadow:none;width:100%;max-width:100%;padding:2rem 0;overflow-wrap:anywhere";
const title=document.createElement("h2"),explain=document.createElement("p");title.textContent=topics[page][0]+" — summary";explain.textContent=topics[page][1];intro.append(title,explain);
const hero=main.querySelector(".hero");if(hero)hero.after(intro);else main.prepend(intro);
const defs=[
["statementAnalysisFindings","Financial statements","Profit measures accounting earnings. Operating cash flow measures cash from operations. Read both alongside debt and the reporting period.","statementAnalysisGaps","statementAnalysisStatus"],
["findings","Company figures","Margins relate profit to sales; cash conversion compares cash generation with profit. Missing inputs cannot be treated as zero.","manualSource"],
["scenarioCards","Scenario analysis","These are outcomes of your growth and margin assumptions, not forecasts or price targets."],
["labExplain","Annual performance","Read profitability, growth, cash generation and debt together; the figures alone do not establish why performance changed.","labGaps","labSource"],
["evaluationFindings","Evaluation findings","These findings describe the available historical accounts. Business quality, governance and competitive position still need evidence from filings.","evaluationGaps","evaluationSource"],
["comparisonOutput","Company comparison","These are historical figures. Different currencies, year ends, industries and accounting policies can prevent a direct comparison.","comparisonNotes"],
["healthOutput","Financial warning checks","A triggered pattern is a question for further research. Insufficient data means the check cannot reach a conclusion.","healthSource"],
["quarterResults","Quarterly performance","An increase in revenue or profit is a historical change. Margin changes are percentage points; investigate the cause in the filing.","quarterGaps","reportSource"],
["evidenceLedger","Available evidence","This ledger records figures and calculations, not independently verified facts. Read the source period and check the original report.","reportSource"],
["evidenceClaims","AI evidence draft","AI interpretations remain unverified even when they cite a valid evidence ID.","aiStatus"],
["articleLink","Selected news","Read the full linked article, distinguish fact from hypothesis, and explain the possible business channel.","newsStatus"],
["autoAnalysisOutput","Company overview","This explanation may be AI-generated. Verify business descriptions and financial claims against company disclosures.","autoAnalysisStatus"],
["aiAnswer","AI explanation","Use this as an explanation to check, not a recommendation or a verified conclusion.","aiStatus"]
];
function text(el){if(!el||el.hidden||el.closest("[hidden]"))return "";return el.textContent.replace(/\s+/g," ").trim();}
for(const [id,label,meaning,...context] of defs){
 const target=$(id);if(!target)continue;
 const section=document.createElement("section");section.className="analysis-summary";section.style.cssText=intro.style.cssText;
 const h=document.createElement("h3"),p=document.createElement("p"),result=document.createElement("p"),basis=document.createElement("p");h.textContent=label+" — in plain language";p.textContent=meaning;basis.className="muted";section.append(h,p,result,basis);target.after(section);
 function update(){const value=text(target);const table=target.querySelector("table");let brief=value;if(table){const rows=[...table.querySelectorAll("tbody tr")];brief=rows.slice(0,4).map(row=>[...row.children].map(cell=>cell.textContent.replace(/\s+/g," ").trim()).join(": ")).join("; ")+(rows.length>4?"; more figures are listed above.":".");}else{brief=(value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[value]).slice(0,3).join(" ").trim();}result.textContent=value?"Current results: "+brief:"Load or calculate this analysis to see a summary of its results.";basis.textContent=context.map(x=>text($(x))).filter(Boolean).join(" "); }
 const observer=new MutationObserver(update);observer.observe(target,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["hidden"]});
 for(const x of context)if($(x))observer.observe($(x),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["hidden"]});
 const container=target.closest("[hidden]");if(container)observer.observe(container,{attributes:true,attributeFilter:["hidden"]});update();
}
if(!["news.html","financial-instruments.html","dashboard.html"].includes(page)){
 const h=document.createElement("h3"),p=document.createElement("p"),button=document.createElement("button"),out=document.createElement("div");
 h.textContent="How does this company work?";p.textContent="Explain its products or services, customers, revenue model, main costs and business risks. An unverified AI business explanation loads automatically with the analysis. Your notebook notes are not sent.";
 button.type="button";button.textContent="Explain company business ↗";out.setAttribute("role","status");intro.append(h,p,out);
 const input=$("evaluationSymbol")||$("companyA")||$("labSymbol")||$("toolSymbol");
 let revision=0;
 input?.addEventListener("input",()=>{revision++;out.textContent="";});
 async function explainBusiness(){
 const company=input?.value.trim().toUpperCase();if(!company||!/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(company)){out.textContent="Enter the company ticker above first.";return;}
 const version=++revision;button.disabled=true;out.textContent="Explaining "+company+"…";
 try{
 const r=await fetch("/api/company-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company}),signal:AbortSignal.timeout(45000)}),d=await r.json();
 if(version!==revision)return;
 if(!r.ok)throw Error(d.error||"Business explanation unavailable.");
 out.textContent=company+" — AI-generated, unverified business explanation: "+(d.answer||"No explanation returned. Check the company’s annual report.");
 }catch(e){if(version===revision)out.textContent="Business explanation unavailable. Read the company’s annual report for products, customers, revenue sources and risks. "+(e.name==="TimeoutError"?"Request timed out.":e.message);}
 finally{button.disabled=false;}
 }
 const status=$("evaluationStatus")||$("toolkitStatus")||$("labStatus")||$("toolStatus");
 let last="";
 const auto=()=>{const value=status?.textContent||"",company=input?.value.trim().toUpperCase();if(!company||!(/loaded/i.test(value))||/loading|could not|unavailable/i.test(value))return;const key=company+"|"+value;if(key===last)return;last=key;explainBusiness();};
 if(status)new MutationObserver(auto).observe(status,{childList:true,subtree:true,characterData:true});auto();
}
})();
