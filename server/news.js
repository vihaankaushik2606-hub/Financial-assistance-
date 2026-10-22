"use strict";
function normalizeNews(data,symbol=""){
 const seen=new Set();
 return(Array.isArray(data)?data:[]).filter(item=>item&&typeof item==="object").filter(item=>!symbol||!item.symbol||String(item.symbol).toUpperCase().split(",").map(s=>s.trim()).includes(symbol)).map(item=>{
 let url;try{url=new URL(item.url);if(!["https:","http:"].includes(url.protocol)||url.username||url.password)return null;}catch{return null;}
 const title=String(item.title||"").trim().slice(0,350);if(!title||seen.has(url.href))return null;seen.add(url.href);
 return{title,url:url.href,publisher:String(item.publisher||item.site||url.hostname).slice(0,120),publishedDate:String(item.publishedDate||"").slice(0,40),symbol:String(item.symbol||symbol).slice(0,24)};
 }).filter(Boolean).sort((a,b)=>String(b.publishedDate).localeCompare(String(a.publishedDate))).slice(0,12);
}
module.exports={normalizeNews};