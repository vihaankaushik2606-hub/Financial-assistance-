
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.SituationCalculator=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
function number(v){if(!["number","string"].includes(typeof v)||String(v).trim()===""||!Number.isFinite(Number(v)))throw Error("Complete every numeric field with a finite number.");return Number(v);}
function calculate(base,change){
 const b={},c={};for(const k of ["revenue","variable","fixed","debt","rate"])b[k]=number(base[k]);for(const k of ["volume","price","unitCost","fixedCost","ratePoints"])c[k]=number(change[k]);
 if(Object.values(b).some(v=>v<0)||b.rate>100)throw Error("Base figures must be non-negative; interest rate must be between 0 and 100.");
 if(["volume","price","unitCost","fixedCost"].some(k=>c[k]<-100||c[k]>1000))throw Error("Percentage changes must be between −100% and 1,000%.");
 const rate=b.rate+c.ratePoints;if(rate<0||rate>100)throw Error("The resulting interest rate must be between 0% and 100%.");
 const revenue=b.revenue*(1+c.volume/100)*(1+c.price/100),variable=b.variable*(1+c.volume/100)*(1+c.unitCost/100),fixed=b.fixed*(1+c.fixedCost/100),interest=b.debt*rate/100,operating=revenue-variable-fixed,profit=operating-interest,contribution=revenue>0?(revenue-variable)/revenue:null,breakEven=contribution>0?(fixed+interest)/contribution:null;
 const result={revenue,variable,fixed,interest,operating,profit,margin:revenue>0?profit/revenue*100:null,breakEven};
 if(Object.values(result).some(v=>v!==null&&!Number.isFinite(v)))throw Error("These inputs produce figures outside the supported numeric range.");
 return result;
}
return{calculate};
});
if(typeof document!=="undefined")(()=>{
"use strict";const $=id=>document.getElementById(id),calc=window.SituationCalculator.calculate;
const keys=["volume","price","unitCost","fixedCost","ratePoints"],baseKeys=["revenue","variable","fixed","debt","rate"];let snapshot=null;
const fmt=(v,percent=false)=>v===null?"Unavailable":new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v)+(percent?"%":" "+$("sitCurrency").value.trim().toUpperCase());
const read=prefix=>Object.fromEntries(keys.map(k=>[k,$(prefix+k).value]));
function render(){
 try{
 const currency=$("sitCurrency").value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(currency))throw Error("Use a three-letter currency code, such as INR or USD.");
 const base=Object.fromEntries(baseKeys.map(k=>[k,$("sit"+k).value])),a=read("if"),b=read("else"),zero=Object.fromEntries(keys.map(k=>[k,0]));
 const results=[calc(base,zero),calc(base,a),calc(base,b)],labels=["Current situation","What if?","What else?"],rows=[["Currency",currency],["Period","One year"],["Source","User-entered assumptions; not fetched company data"],...baseKeys.map(k=>["Base "+k,base[k]]),...keys.map(k=>["What if "+k,a[k]]),...keys.map(k=>["What else "+k,b[k]]),["Metric",...labels]];
 const metrics=[["revenue","Revenue"],["variable","Variable costs"],["fixed","Fixed costs"],["interest","Annual interest"],["operating","Operating profit"],["profit","Profit before tax"],["margin","Profit-before-tax margin"],["breakEven","Revenue to cover costs and interest"]];
 const table=document.createElement("table"),caption=table.createCaption();caption.textContent="Annual outcomes from your assumptions";
 const header=table.createTHead().insertRow();["Metric",...labels].forEach(t=>{const th=document.createElement("th");th.scope="col";th.textContent=t;header.append(th);});
 const body=table.createTBody();for(const [key,label]of metrics){const tr=body.insertRow(),th=document.createElement("th");th.scope="row";th.textContent=label;tr.append(th);for(const r of results)tr.insertCell().textContent=fmt(r[key],key==="margin");rows.push([label,...results.map(r=>r[key]===null?"Unavailable":r[key])]);}
 $("sitTable").replaceChildren(table);$("sitSummaries").replaceChildren();
 results.forEach((r,i)=>{const h=document.createElement("h3"),p=document.createElement("p");h.textContent=labels[i]+" — summary";p.textContent="Revenue is "+fmt(r.revenue)+", with "+fmt(r.variable+r.fixed)+" of operating costs and "+fmt(r.interest)+" annual interest. This leaves a "+(r.profit<0?"loss":"profit")+" before tax of "+fmt(Math.abs(r.profit))+"."+(i?" That is "+fmt(Math.abs(r.profit-results[0].profit))+(r.profit>=results[0].profit?" higher":" lower")+" than the current situation.":"")+(r.breakEven===null?" A revenue break-even point cannot be calculated because the contribution margin is zero or negative.":" At this scenario’s cost mix, revenue of "+fmt(r.breakEven)+" would cover costs and interest.");$("sitSummaries").append(h,p);rows.push([h.textContent,p.textContent]);});
 const sensitivity=document.createElement("table");sensitivity.createCaption().textContent="What if sales volume changes? Other base assumptions stay unchanged.";
 const sh=sensitivity.createTHead().insertRow();["Volume change","Revenue","Profit before tax"].forEach(t=>{const th=document.createElement("th");th.textContent=t;th.scope="col";sh.append(th);});const sb=sensitivity.createTBody();
 for(const volume of [-20,-10,0,10,20]){const r=calc(base,{...zero,volume}),tr=sb.insertRow();[volume+"%",fmt(r.revenue),fmt(r.profit)].forEach(t=>tr.insertCell().textContent=t);rows.push(["Volume sensitivity "+volume+"%",r.revenue,r.profit]);}
 $("sitSensitivity").replaceChildren(sensitivity);snapshot={rows,currency};$("sitResults").hidden=false;$("sitStatus").textContent="Calculated from your annual inputs. Results are hypothetical, not forecasts.";
 }catch(e){snapshot=null;$("sitResults").hidden=true;$("sitStatus").textContent=e.message;}
}
$("sitForm").addEventListener("submit",e=>{e.preventDefault();render();});
$("sitForm").addEventListener("input",()=>{snapshot=null;$("sitResults").hidden=true;$("sitStatus").textContent="Assumptions changed. Calculate again to update the comparison.";});
const presets={sales:{volume:-20,price:0,unitCost:0,fixedCost:0,ratePoints:0},costs:{volume:0,price:0,unitCost:15,fixedCost:10,ratePoints:0},rates:{volume:0,price:0,unitCost:0,fixedCost:0,ratePoints:2}};
$("sitPreset").addEventListener("change",()=>{const p=presets[$("sitPreset").value];if(!p)return;keys.forEach(k=>$("if"+k).value=p[k]);snapshot=null;$("sitResults").hidden=true;$("sitStatus").textContent="What-if preset applied. Edit either scenario, then calculate.";});
$("sitExample").addEventListener("click",()=>{[1000000,600000,200000,300000,10].forEach((v,i)=>$("sit"+baseKeys[i]).value=v);keys.forEach(k=>{$("if"+k).value=presets.sales[k];$("else"+k).value=k==="price"?5:0;});$("sitPreset").value="sales";$("sitStatus").textContent="Illustrative example filled; these are not company figures.";snapshot=null;$("sitResults").hidden=true;});
$("sitCsv").addEventListener("click",()=>{if(snapshot)window.ReportExport.download("situation-calculator.csv",window.ResearchExtras.csv(snapshot.rows),"text/csv;charset=utf-8");});
$("sitPdf").addEventListener("click",()=>{if(snapshot)window.ReportExport.print(window.ReportExport.html("Situation calculator — hypothetical annual model",snapshot.rows));});
})();
