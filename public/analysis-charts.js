(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.AnalysisCharts=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>v===null||v===undefined||typeof v==="boolean"||String(v).trim()===""||!Number.isFinite(Number(v))?null:Number(v);
function prepare(data){
 const symbol=String(data.symbol||"").toUpperCase(), statements=data.statements||{};
 const rows=key=>(statements[key]?.available?statements[key].annualReports||[]:[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date||"")&&Number.isFinite(Date.parse(r.date))&&r.reportedCurrency&&(!r.period||r.period==="FY")&&(!r.symbol||String(r.symbol).toUpperCase()===symbol)).sort((a,b)=>b.date.localeCompare(a.date));
 const income=rows("incomeStatement"),cash=rows("cashFlow"),balance=rows("balanceSheet");
 const anchor=income[0]||balance[0]||cash[0];if(!anchor)return{symbol,charts:[],currency:"",isDemo:!!data.isDemo};
 const currency=anchor.reportedCurrency;
 const selected=list=>{const seen=new Set();return list.filter(r=>r.reportedCurrency===currency&&!seen.has(r.date)&&seen.add(r.date)).slice(0,5).reverse();};
 const definitions=[
 ["Revenue","income",income,[["Revenue","revenue","#c49aff"]]],
 ["Net income","income",income,[["Net income","netIncome","#c49aff"]]],
 ["Profit and operating cash flow","cash",income,[["Net income","netIncome","#c49aff"],["Operating cash flow","operatingCashFlow","#d6b88b"]]],
 ["Debt and cash","balance",balance,[["Total debt","totalDebt","#c49aff"],["Cash and equivalents","cashAndCashEquivalents","#b9e9bf"]]]
 ];
 return{symbol,currency,isDemo:!!data.isDemo,charts:definitions.map(([title,type,base,series])=>{
 const periods=selected(base);
 return{title,dates:periods.map(r=>r.date),series:series.map(([label,key,color])=>({label,color,values:periods.map(r=>{
 const source=type==="cash"&&key==="operatingCashFlow"?cash.find(c=>c.date===r.date&&c.reportedCurrency===currency):r;
 return num(source?.[key]);})}))};
 }).filter(c=>c.series.some(s=>s.values.some(v=>v!==null)))};
}
function render(data,mount){
 if(!mount)return;const report=prepare(data);
 if(!report.charts.length){mount.innerHTML='<p class="muted">Trend charts need dated annual statements with a reporting currency.</p>';return;}
 const compact=v=>new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(v);
 mount.innerHTML='<p class="muted">'+esc(report.symbol)+" · "+esc(report.currency)+" · "+(report.isDemo?"Illustrative demo figures":"Financial Modeling Prep annual statements")+'. Up to five available annual periods; missing points are omitted. Verify against annual filings.</p><div class="financial-chart-grid">'+report.charts.map(c=>{
 const all=c.series.flatMap(s=>s.values).filter(v=>v!==null);
 const low=Math.min(0,...all),high=Math.max(0,...all),span=high-low||1;
 const x=i=>62+i*(476/Math.max(1,c.dates.length-1)),y=v=>190-(v-low)/span*156;
 const zero=y(0);
 const ticks=[low,low+span/2,low+span].map(v=>'<text x="54" y="'+(y(v)+4)+'" text-anchor="end">'+esc(compact(v))+'</text>').join("");
 const lines=c.series.map(s=>{let pen=false;const d=s.values.map((v,i)=>{if(v===null){pen=false;return"";}const cmd=pen?"L":"M";pen=true;return cmd+x(i).toFixed(1)+" "+y(v).toFixed(1);}).join(" ");
 return '<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="3" vector-effect="non-scaling-stroke"/>'+s.values.map((v,i)=>v===null?"":'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="4" fill="'+s.color+'"><title>'+esc(s.label+" · "+c.dates[i]+" · "+report.currency+" "+v.toLocaleString())+'</title></circle>').join("");}).join("");
 const labels=c.dates.map((d,i)=>'<text x="'+x(i)+'" y="216" text-anchor="middle">'+esc(d.slice(0,7))+'</text>').join("");
 const table='<details><summary>View exact figures</summary><div class="table-wrap"><table><thead><tr><th>Year ended</th>'+c.series.map(s=>'<th>'+esc(s.label)+'</th>').join("")+'</tr></thead><tbody>'+c.dates.map((date,i)=>'<tr><td>'+date+'</td>'+c.series.map(s=>'<td>'+(s.values[i]===null?"Unavailable":esc(report.currency+" "+s.values[i].toLocaleString()))+'</td>').join("")+'</tr>').join("")+'</tbody></table></div></details>';
 return '<figure class="financial-chart"><figcaption>'+esc(c.title)+'</figcaption><div class="financial-chart-legend">'+c.series.map(s=>'<span><i style="background:'+s.color+'"></i>'+esc(s.label)+'</span>').join("")+'</div><svg viewBox="0 0 600 236" role="img" aria-label="'+esc(c.title+" in "+report.currency+"; exact figures in table below")+'"><line x1="62" x2="538" y1="'+zero+'" y2="'+zero+'" stroke="#beaecf" opacity=".25"/>'+ticks+lines+labels+'</svg>'+table+'</figure>';
 }).join("")+'</div>';
}
return{prepare,render};
});