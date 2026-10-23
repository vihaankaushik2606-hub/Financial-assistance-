(() => {
"use strict";
const $=id=>document.getElementById(id), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fields=[...document.querySelectorAll("[data-note]")];
let current=null,report=null,draftKey="";
function save(){
 if(!draftKey)return;
 try{localStorage.setItem(draftKey,JSON.stringify(Object.fromEntries(fields.map(f=>[f.id,f.value]))));$("labSaveStatus").textContent="Saved on this browser and device only. Notes are not synced to your account.";}
 catch{$("labSaveStatus").textContent="This browser could not save your notes. Download a notebook to keep them.";}
}
function readDraft(){
 fields.forEach(f=>f.value="");
 try{const d=JSON.parse(localStorage.getItem(draftKey)||"{}");fields.forEach(f=>{if(typeof d[f.id]==="string")f.value=d[f.id];});}catch{}
}
const format=m=>m.unit==="money"?report.currency+" "+new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:2}).format(m.value):m.unit==="percent"?m.value.toFixed(1)+"%":m.value.toFixed(2)+"×";
async function get(path){const r=await fetch(path);const d=await r.json();if(!r.ok)throw Error(d.error||"Market data unavailable.");return d;}
async function load(){
 const symbol=$("labSymbol").value.trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(symbol)){$("labStatus").textContent="Enter a valid company ticker.";return;}
 if($("labLoad").disabled)return;
 window.dispatchEvent(new Event("lab-company-reset"));save();current=null;report=null;draftKey="";$("labLoad").disabled=true;$("labSymbol").readOnly=true;$("labReport").hidden=true;$("labFields").disabled=true;$("labReviewOutput").replaceChildren();$("labStatus").textContent="Loading annual statements for "+symbol+"…";
 try{
 const [f,q]=await Promise.allSettled([get("/api/fundamentals?symbol="+encodeURIComponent(symbol)),get("/api/quote?symbol="+encodeURIComponent(symbol))]);
 if(f.status!=="fulfilled")throw f.reason;
 current=f.value;window.dispatchEvent(new CustomEvent("lab-company-loaded",{detail:{data:current}}));report=window.StatementAnalysis.analyze(current);draftKey="finance-research-notebook-v1:"+symbol+":"+(report.date||"undated")+":"+(report.currency||"unknown");readDraft();
 const name=q.status==="fulfilled"?(q.value.quote?.raw?.name||symbol):symbol;
 $("labCompany").textContent=name+" · "+symbol+". Add a verified business description below.";
 $("labSource").textContent=symbol+" · "+(report.date?"year ended "+report.date:"no usable annual reporting date")+" · "+(report.currency||"currency unavailable")+" · "+(report.isDemo?"ILLUSTRATIVE DEMO DATA":"Financial Modeling Prep annual statements")+"."+(current.fetchedAt?" Data fetched "+new Date(current.fetchedAt).toLocaleString()+".":"")+(current.marketData?.stale?" Older saved data; refresh unavailable.":"");
 $("labMetrics").innerHTML=report.metrics.map(m=>'<div class="metric"><div class="label">'+esc(m.label)+'</div><div class="value">'+esc(format(m))+'</div></div>').join("");
 window.AnalysisCharts.render(current,$("labCharts"));
 $("labExplain").innerHTML=report.findings.map(f=>'<article class="finding"><h3>'+esc(f.title)+'</h3><p>'+esc(f.text)+'</p></article>').join("");
 $("labGaps").textContent=report.gaps.join(" ");
 $("labEvidence").innerHTML='<table><thead><tr><th>Metric / claim</th><th>Figure</th><th>Calculation / basis</th></tr></thead><tbody>'+report.metrics.map(m=>'<tr><td>'+esc(m.label)+'</td><td>'+esc(format(m))+'</td><td>'+esc(m.formula)+'</td></tr>').join("")+'</tbody></table><p class="muted">Source: '+(report.isDemo?'illustrative sample':'Financial Modeling Prep')+'. Reporting period and currency shown above. These provider results do not include filing-page citations; add verified references below.</p>';
 $("labFields").disabled=false;$("labReport").hidden=false;$("labStatus").textContent="Research loaded. Follow the five steps; write and verify your own reasoning.";
 $("labSaveStatus").textContent="Notes stay in this browser on this device. Download a notebook to keep a backup.";
 }catch(e){$("labStatus").textContent="Could not start research: "+e.message;}
 finally{$("labLoad").disabled=false;$("labSymbol").readOnly=false;}
}
$("labLoad").addEventListener("click",load);$("labSymbol").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();load();}});
fields.forEach(f=>f.addEventListener("input",()=>{save();$("labReviewOutput").replaceChildren();}));
function checks(){
 const text=$("conclusionNotes").value.trim(),notes=id=>$(id).value.trim(),result=[];
 if(!text)return["Write a conclusion first, then check it against your evidence."];
 result.push("This checklist checks completeness and selected phrases. It has not verified your claims.");
 if(!notes("businessNotes"))result.push("Explain how the business earns revenue before drawing financial conclusions.");
 if(!notes("evidenceNotes"))result.push("Add a source page and verification note for each important factual claim.");
 let valid=false;try{valid=["https:","http:"].includes(new URL(notes("sourceUrl")).protocol);}catch{}
 if(!valid)result.push("Add a valid official filing URL. A URL alone does not verify a claim.");
 if(!notes("riskNotes"))result.push("State the main risks and unanswered questions.");
 if(!notes("alternativeNotes"))result.push("Include an alternative explanation that fits the same figures.");
 if(/guarantee|risk.free|sure.shot|cannot lose/i.test(text))result.push("Remove certainty about returns. Historical figures cannot guarantee an outcome.");
 if(/\b(buy|sell|hold)\b/i.test(text))result.push("Review recommendation-like wording. This workspace is for educational company research.");
 if(report?.isDemo)result.push("Your analysis uses demo figures. Replace them with verified company figures before sharing.");
 if(report?.gaps.length)result.push("Address the stated data gaps before treating the analysis as complete.");
 result.push("Manually check: does each claim follow from matching years, currencies and reporting basis? What would change your conclusion?");
 return result;
}
$("labReview").addEventListener("click",()=>{$("labReviewOutput").innerHTML="<ul>"+checks().map(t=>"<li>"+esc(t)+"</li>").join("")+"</ul>";});
$("labClear").addEventListener("click",()=>{fields.forEach(f=>f.value="");save();$("labReviewOutput").replaceChildren();$("labSaveStatus").textContent="This company’s saved notes were cleared on this device.";});
function exportHtml(){
 const notes=fields.map(f=>'<section><h2>'+esc(document.querySelector('label[for="'+f.id+'"]')?.textContent||f.id)+'</h2><div contenteditable="true" style="white-space:pre-wrap;min-height:48px">'+esc(f.value||"Add your notes here.")+'</div></section>').join("");
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>'+esc(report.symbol)+' research notebook</title><style>body{max-width:960px;margin:40px auto;padding:24px;font:16px/1.6 system-ui;color:#20202a}h1,h2{line-height:1.25}svg{width:100%;height:auto}svg text{fill:#444;font:12px system-ui}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}.table-wrap{overflow:auto}figure{margin:24px 0}section{margin:32px 0}summary{cursor:pointer}details{margin:12px 0}details:not([open])>div{display:block}[contenteditable]{border-left:2px solid #b391dc;padding-left:14px}i{display:inline-block;width:8px;height:8px;margin-right:6px}p{overflow-wrap:anywhere}@media print{body{margin:0}section,figure{break-inside:avoid}}</style></head><body><h1>'+esc(report.symbol)+' — Research notebook</h1><p>'+esc($("labSource").textContent)+'</p><p>Exported '+esc(new Date().toISOString())+'. Educational research; not investment advice. Editable notes below are the author’s interpretations, not verified provider statements.</p><h2>Financial charts</h2>'+$("labCharts").innerHTML+'<h2>Metric evidence</h2>'+$("labEvidence").innerHTML+'<h2>Calculated explanations</h2>'+$("labExplain").innerHTML+notes+'<h2>Review checklist</h2><ul>'+checks().map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></body></html>';
}
$("labExport").addEventListener("click",()=>{
 if(!report)return;save();const url=URL.createObjectURL(new Blob([exportHtml()],{type:"text/html;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=report.symbol+"-research-notebook.html";a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
$("labPrint").addEventListener("click",()=>{if(!report)return;save();window.ReportExport.print(exportHtml());});
$("labCsv").addEventListener("click",()=>{if(!report)return;save();const rows=[["Company",report.symbol],["Source",$("labSource").textContent],["Exported",new Date().toISOString()],["Metric","Exact value","Unit","Basis"],...report.metrics.map(m=>[m.label,m.value,m.unit,m.formula]),["Data gaps",report.gaps.join(" ")],...report.findings.map(f=>[f.title,f.text]),...fields.map(f=>[document.querySelector('label[for="'+f.id+'"]')?.textContent||f.id,f.value]),["Status","Educational research; notes are user interpretations, not recommendations."]];window.ReportExport.download(report.symbol+"-research-notebook.csv",window.ResearchExtras.csv(rows),"text/csv;charset=utf-8");});
const querySymbol=new URLSearchParams(location.search).get("symbol")?.toUpperCase();if(querySymbol&&/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(querySymbol)){$("labSymbol").value=querySymbol;load();}
})();