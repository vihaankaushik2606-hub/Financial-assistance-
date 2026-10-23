"use strict";
function normalizeNews(data,symbol=""){
 const seen=new Set();
 return(Array.isArray(data)?data:[]).filter(item=>item&&typeof item==="object").filter(item=>!symbol||!item.symbol||String(item.symbol).toUpperCase().split(",").map(s=>s.trim()).includes(symbol)).map(item=>{
 let url;try{url=new URL(item.url);if(!["https:","http:"].includes(url.protocol)||url.username||url.password)return null;}catch{return null;}
 const title=String(item.title||"").trim().slice(0,350);if(!title||seen.has(url.href))return null;seen.add(url.href);
 let image="";try{const candidate=new URL(item.image||item.imageUrl);if(candidate.protocol==="https:"&&!candidate.username&&!candidate.password)image=candidate.href;}catch{}
 const excerpt=String(item.text||item.description||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,280);
 return{image,excerpt,title,url:url.href,publisher:String(item.publisher||item.site||url.hostname).slice(0,120),publishedDate:String(item.publishedDate||"").slice(0,40),symbol:String(item.symbol||symbol).slice(0,24)};
 }).filter(Boolean).sort((a,b)=>String(b.publishedDate).localeCompare(String(a.publishedDate))).slice(0,12);
}
module.exports={normalizeNews};function parsePublisherFeed(xml){
 const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
 const tag=(s,name)=>decode((s.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'))||[])[1]);
 return normalizeNews((String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi)||[]).map(item=>({title:tag(item,'title'),url:tag(item,'link'),publishedDate:(()=>{const d=new Date(tag(item,'pubDate'));return Number.isFinite(d.getTime())?d.toISOString():'';})(),description:tag(item,'description'),publisher:'CNBC',image:decode((item.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["']/i)||[])[1])})));
}
let publisherCache=null,publisherPending=null;
async function latestPublisherNews(){
 if(publisherCache&&publisherCache.until>Date.now())return publisherCache.articles;
 if(publisherPending)return publisherPending;
 publisherPending=(async()=>{const r=await fetch('https://www.cnbc.com/id/100003114/device/rss/rss.html',{headers:{Accept:'application/rss+xml,application/xml,text/xml'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Publisher news is temporarily unavailable. Please try again later.');const xml=await r.text();if(xml.length>2000000)throw Error('Publisher feed is too large.');const articles=parsePublisherFeed(xml);if(!articles.length)throw Error('No publisher stories are available yet.');publisherCache={articles,until:Date.now()+30*60*1000};return articles;})();
 try{return await publisherPending;}finally{publisherPending=null;}
}
module.exports.parsePublisherFeed=parsePublisherFeed;
module.exports.latestPublisherNews=latestPublisherNews;
