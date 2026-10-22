(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QuarterlyAnalysis=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const n=v=>!['number','string'].includes(typeof v)||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
const days=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
function analyze(data,mode='yoy'){
 const symbol=String(data.symbol||'').toUpperCase(),gaps=[];
 const rows=key=>(data.statements?.[key]?.available?data.statements[key].quarterlyReports||[]:[]).filter(r=>r&&/^Q[1-4]$/.test(r.period)&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&Number.isFinite(Date.parse(r.date))&&r.reportedCurrency&&(!r.symbol||String(r.symbol).toUpperCase()===symbol)).sort((a,b)=>b.date.localeCompare(a.date));
 const income=rows('incomeStatement'),balances=rows('balanceSheet'),flows=rows('cashFlow'),latest=income[0];
 const out={symbol,isDemo:!!data.isDemo,mode,date:latest?.date,currency:latest?.reportedCurrency,priorDate:null,metrics:[],gaps};
 if(!latest){gaps.push('No dated quarterly income statements are available. Annual or year-to-date figures are not substituted.');return out;}
 const prev=income.find(r=>r.reportedCurrency===latest.reportedCurrency&&(mode==='qoq'?days(latest.date,r.date)>=60&&days(latest.date,r.date)<=120&&Number(r.period[1])===(Number(latest.period[1])+2)%4+1:days(latest.date,r.date)>=300&&days(latest.date,r.date)<=430&&r.period===latest.period));
 if(!prev){gaps.push('A matching '+(mode==='qoq'?'previous quarter':'quarter one year earlier')+' with the same currency is unavailable.');return out;}out.priorDate=prev.date;
 const match=(a,r)=>a.find(x=>x.date===r.date&&x.reportedCurrency===r.reportedCurrency&&x.period===r.period);
 function add(label,a,b,unit,basis){if(a===null||b===null){gaps.push(label+': a comparable value is missing.');return;}out.metrics.push({label,current:a,previous:b,delta:a-b,change:unit==='percent'?null:(b>0&&a>=0?(a/b-1)*100:null),unit,basis});}
 add('Revenue',n(latest.revenue),n(prev.revenue),'money','Quarterly income statements: revenue');
 add('Net income',n(latest.netIncome),n(prev.netIncome),'money','Quarterly income statements: netIncome');
 const margin=r=>n(r.revenue)>0&&n(r.netIncome)!==null?n(r.netIncome)/n(r.revenue)*100:null;
 add('Net profit margin',margin(latest),margin(prev),'percent','Net income ÷ revenue × 100; change is percentage points');
 const a=match(balances,latest),b=match(balances,prev);
 add('Total debt',n(a?.totalDebt),n(b?.totalDebt),'money','Matching quarter-end balance sheets: totalDebt');
 add('Cash',n(a?.cashAndCashEquivalents),n(b?.cashAndCashEquivalents),'money','Matching quarter-end balance sheets: cashAndCashEquivalents');
 // FMP standardized cash-flow records are requested with period=quarter; never derive a quarter from annual/YTD records here.
 const ca=match(flows,latest),cb=match(flows,prev);
 add('Operating cash flow',n(ca?.operatingCashFlow),n(cb?.operatingCashFlow),'money','Provider-standardized quarterly cash flow: operatingCashFlow; verify reporting basis in the filing');
 if(mode==='qoq')gaps.push('Quarter-on-quarter changes can reflect seasonality; compare the same quarter last year too.');
 return out;
}
return{analyze};});
