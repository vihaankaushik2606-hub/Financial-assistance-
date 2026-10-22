(() => {
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const requests=new WeakMap();
window.CompanyNews={cancel(mount){requests.set(mount,(requests.get(mount)||0)+1);},async load(symbol,mount,status){
 const id=(requests.get(mount)||0)+1;requests.set(mount,id);mount.replaceChildren();status.textContent="Loading publisher headlines…";
 try{
 const r=await fetch("/api/news"+(symbol?"?symbol="+encodeURIComponent(symbol):""));const d=await r.json();if(requests.get(mount)!==id)return;if(!r.ok)throw Error(d.error||"News unavailable.");
 status.textContent=(symbol?symbol+" · ":"Market headlines · ")+d.source+" · fetched "+new Date(d.fetchedAt).toLocaleString()+". Publication times are shown as supplied; timezone may be unspecified.";
 if(!d.articles?.length){mount.innerHTML='<p class="muted">No headlines were returned for this selection.</p>';return;}
 mount.innerHTML=d.articles.map(a=>{
 let url;try{url=new URL(a.url);if(!["https:","http:"].includes(url.protocol))return"";}catch{return"";}
 return '<article class="news-item"><p class="news-meta">'+esc(a.publisher)+" · "+esc(a.publishedDate||"Publication time unavailable")+(a.symbol?" · "+esc(a.symbol):"")+'</p><h3><a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+' ↗</a></h3><p class="muted">Research question: does this report change your assumptions about revenue, costs, cash flow or risk? Read the original article before drawing conclusions.</p></article>';
 }).join("");
 }catch(e){if(requests.get(mount)===id)status.textContent="News unavailable: "+e.message;}
}};
const btn=document.getElementById("newsLoad"),input=document.getElementById("newsSymbol");
if(btn){const load=async()=>{if(btn.disabled)return;const symbol=input.value.trim().toUpperCase();if(symbol&&!/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(symbol)){document.getElementById("newsStatus").textContent="Enter a valid ticker, or leave blank for market news.";return;}btn.disabled=true;await window.CompanyNews.load(symbol,document.getElementById("newsList"),document.getElementById("newsStatus"));btn.disabled=false;};btn.addEventListener("click",load);input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();load();}});document.getElementById("newsStatus").textContent="Choose a ticker, or leave blank for market headlines, then click Load news.";}
})();