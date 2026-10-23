(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.ResearchExtras=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const n=v=>(typeof v==="number"||typeof v==="string")&&String(v).trim()!==""&&Number.isFinite(Number(v))?Number(v):null;
function health(data){
 const symbol=String(data.symbol||"").toUpperCase(),checks=[];
 const rows=key=>{const seen=new Set();return(data.statements?.[key]?.available?data.statements[key].quarterlyReports||[]:[]).filter(r=>r&&/^Q[1-4]$/.test(r.period)&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||"")&&Number.isFinite(Date.parse(r.date))&&r.reportedCurrency&&(!r.symbol||String(r.symbol).toUpperCase()===symbol)).slice().sort((a,b)=>b.date.localeCompare(a.date)).filter(r=>{if(seen.has(r.date))return false;seen.add(r.date);return true;});};
 const income=rows("incomeStatement"),balances=rows("balanceSheet"),cash=rows("cashFlow"),latest=income[0],currency=latest?.reportedCurrency;
 const match=(items,r)=>items.find(x=>x.date===r.date&&x.period===r.period&&x.reportedCurrency===r.reportedCurrency);
 const consecutive=(a,b)=>{const days=(Date.parse(a.date)-Date.parse(b.date))/86400000;return days>=60&&days<=120&&Number(b.period[1])===(Number(a.period[1])+2)%4+1&&a.reportedCurrency===b.reportedCurrency;};
 const add=(id,title,state,detail,basis)=>checks.push({id,title,state,detail,basis});
 const three=income.slice(0,3),validThree=three.length===3&&consecutive(three[0],three[1])&&consecutive(three[1],three[2]);
 const pairs=three.map(r=>({date:r.date,income:n(r.netIncome),cash:n(match(cash,r)?.operatingCashFlow)}));
 if(!validThree||pairs.some(p=>p.income===null||p.income<=0||p.cash===null))add("cash","Cash flow versus profit","missing","Three consecutive matched quarters with positive net income and operating cash flow are needed.","OCF < net income in each of the latest 3 quarters; provider-standardized quarterly values, verify against filings.");
 else add("cash","Cash flow versus profit",pairs.every(p=>p.cash<p.income)?"review":"clear",pairs.map(p=>p.date+": cash "+p.cash+" / profit "+p.income+" "+currency).join("; "),"OCF < net income for 3 consecutive quarters. Timing and non-cash items can explain differences; this does not establish misstatement.");
 const prior=income[1],a=latest&&match(balances,latest),b=prior&&match(balances,prior);
 const da=n(a?.totalDebt),db=n(b?.totalDebt),ea=n(a?.totalStockholdersEquity),eb=n(b?.totalStockholdersEquity);
 if(!latest||!prior||!consecutive(latest,prior)||da===null||db===null||da<0||db<0||!(ea>0)||!(eb>0))add("debt","Debt-to-equity change","missing","Two consecutive matching balance sheets with non-negative debt and positive equity are needed.","Review threshold: ratio rises by at least 0.5× quarter on quarter; not an industry benchmark. Negative equity is not interpreted as low leverage.");
 else {const ratio=da/ea,previous=db/eb;add("debt","Debt-to-equity change",ratio-previous>=.5?"review":"clear",previous.toFixed(2)+"× → "+ratio.toFixed(2)+"× ("+prior.date+" → "+latest.date+")","Total debt ÷ shareholders’ equity. Review threshold: increase ≥ 0.5×; sector and accounting context matter.");}
 const ra=n(latest?.revenue),rb=n(prior?.revenue),pa=n(latest?.netIncome),pb=n(prior?.netIncome);
 if(!latest||!prior||!consecutive(latest,prior)||!(ra>0)||!(rb>0)||pa===null||pb===null)add("margin","Net margin contraction","missing","Two consecutive quarters with positive revenue and reported net income are needed.","Review threshold: net margin decreases by at least 5 percentage points quarter on quarter.");
 else {const now=pa/ra*100,old=pb/rb*100;add("margin","Net margin contraction",old-now>=5?"review":"clear",old.toFixed(1)+"% → "+now.toFixed(1)+"% ("+prior.date+" → "+latest.date+")","Net income ÷ revenue × 100; threshold: decline ≥ 5 percentage points. Seasonality and one-off items may explain it.");}
 return{symbol,isDemo:!!data.isDemo,date:latest?.date||null,currency:currency||null,checks};
}
const scenarioFields=["revenue","bearGrowth","baseGrowth","bullGrowth","bearMargin","baseMargin","bullMargin"];
function scenario(value){if(!value||value.version!==1||typeof value.symbol!=="string"||value.symbol&&!/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(value.symbol))throw Error("Invalid shared scenario.");
 const out={version:1,symbol:value.symbol,currency:String(value.currency||"Unspecified").slice(0,16),period:String(value.period||"User input").slice(0,160),createdAt:String(value.createdAt||"").slice(0,40)};
 for(const key of scenarioFields){const x=n(value[key]);if(x===null||Math.abs(x)>1e16||(key==="revenue"&&x<0)||(key.endsWith("Growth")&&(x< -100||x>1000))||(key.endsWith("Margin")&&(x< -100||x>100)))throw Error("Use revenue ≥ 0, growth from −100% to 1000% and margins from −100% to 100%.");out[key]=x;}return out;
}
function projections(s){s=scenario(s);return["bear","base","bull"].map(k=>{const revenue=s.revenue*(1+s[k+"Growth"]/100);return{case:k,revenue,profit:revenue*s[k+"Margin"]/100};});}
function csvCell(value){let text=String(value??"");if(/^[\s]*[=+\-@]/.test(text)&&!(typeof value==="number"&&Number.isFinite(value)))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
function csv(rows){return "\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");}
return{health,scenario,projections,csv};
});