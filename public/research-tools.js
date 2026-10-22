(() => {
"use strict";
const $=id=>document.getElementById(id),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let current=null,generation=0;
function fmt(m,r){return !m?"Unavailable":m.unit==="money"?(r.currency||"Unknown currency")+" "+new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(m.value):m.unit==="percent"?m.value.toFixed(2)+"%":m.value.toFixed(2)+"×";}
async function news(){if(current)await window.CompanyNews.load(current.symbol,$("labNewsList"),$("labNewsStatus"));}
window.addEventListener("lab-company-reset",()=>{current=null;generation++;window.CompanyNews.cancel($("labNewsList"));["peerOutput","coachOutput","labNewsList","labNewsStatus","peerStatus"].forEach(id=>$(id).textContent="");$("coachAsk").disabled=false;$("peerLoad").disabled=false;});
window.addEventListener("lab-company-loaded",e=>{current=e.detail.data;news();});
$("labNewsRefresh").addEventListener("click",news);
$("peerLoad").addEventListener("click",async()=>{
 if(!current)return;const symbol=$("peerSymbol").value.trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(symbol)){$("peerStatus").textContent="Enter a valid peer ticker.";return;}
 const g=generation,base=current;$("peerLoad").disabled=true;$("peerStatus").textContent="Loading peer statements…";$("peerOutput").textContent="";
 try{const response=await fetch("/api/fundamentals?symbol="+encodeURIComponent(symbol));const data=await response.json();if(!response.ok)throw Error(data.error||"Peer data unavailable.");if(g!==generation)return;
 const a=window.StatementAnalysis.analyze(base),b=window.StatementAnalysis.analyze(data);
 const labels=[...new Set([...a.metrics,...b.metrics].map(m=>m.label))];
 $("peerStatus").textContent="Annual periods: "+(a.date||"unknown")+" / "+(b.date||"unknown")+". "+(a.date!==b.date?"Reporting dates differ. ":"")+(a.currency!==b.currency?"Currencies differ; monetary figures are not directly comparable. ":"")+((a.isDemo||b.isDemo)?"Includes illustrative demo data. ":"")+"No investment ranking.";
 $("peerOutput").innerHTML='<table><thead><tr><th>Metric</th><th>'+esc(base.symbol)+'</th><th>'+esc(symbol)+'</th></tr></thead><tbody>'+labels.map(label=>'<tr><th>'+esc(label)+'</th><td>'+esc(fmt(a.metrics.find(m=>m.label===label),a))+'</td><td>'+esc(fmt(b.metrics.find(m=>m.label===label),b))+'</td></tr>').join("")+'</tbody></table>';
 }catch(e){if(g===generation)$("peerStatus").textContent=e.message;}finally{if(g===generation)$("peerLoad").disabled=false;}
});
$("coachAsk").addEventListener("click",async()=>{
 if(!current)return;
 const g=generation,report=window.StatementAnalysis.analyze(current);
 const tasks={explain:"Explain these reported financial metrics in plain language. Separate observations from possible explanations. Identify limitations and verification steps.",challenge:"Challenge the research conclusion. Identify unsupported claims, alternative explanations and evidence needed. If no conclusion is provided, ask for one.",questions:"Give five specific research questions based on these metrics and gaps, explaining which filing evidence would help answer each."};
 const payload={symbol:current.symbol,date:report.date,currency:report.currency,isDemo:report.isDemo,metrics:report.metrics,gaps:report.gaps};
 if($("coachNotes").checked)payload.unverifiedUserNotes=Object.fromEntries([...document.querySelectorAll("[data-note]")].map(f=>[f.id,f.value.slice(0,500)]));
 $("coachAsk").disabled=true;$("coachOutput").textContent="";$("coachStatus").textContent="Requesting an AI draft…";
 try{const response=await fetch("/api/ai-assist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:tasks[$("coachMode").value],context:JSON.stringify(payload).slice(0,6000)})});const data=await response.json();if(!response.ok)throw Error(data.error||"AI access unavailable.");if(g!==generation)return;
 $("coachOutput").textContent=data.answer||"No answer returned.";$("coachStatus").textContent="AI-generated draft · unverified. Check every factual claim before using it as evidence.";
 }catch(e){if(g===generation)$("coachStatus").textContent=e.message;}finally{if(g===generation)$("coachAsk").disabled=false;}
});
})();