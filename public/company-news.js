(() => {
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const requests=new WeakMap();
window.CompanyNews={cancel(mount){requests.set(mount,(requests.get(mount)||0)+1);},async load(symbol,mount,status){
 const id=(requests.get(mount)||0)+1;requests.set(mount,id);mount.replaceChildren();status.textContent="Loading publisher headlines…";
 try{
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);let r;try{r=await fetch("/api/news"+(symbol?"?symbol="+encodeURIComponent(symbol):""),{signal:controller.signal});}finally{clearTimeout(timeout);}const d=await r.json();if(requests.get(mount)!==id)return;if(!r.ok)throw Error(d.error||"News unavailable.");
 status.textContent=(symbol?symbol+" · ":"Market headlines · ")+d.source+" · fetched "+new Date(d.fetchedAt).toLocaleString()+". Publication times are shown as supplied; timezone may be unspecified.";
 if(!d.articles?.length){mount.innerHTML='<p class="muted">No headlines were returned for this selection.</p>';return;}
 mount.innerHTML=d.articles.map(a=>{
 let url;try{url=new URL(a.url);if(!["https:","http:"].includes(url.protocol))return"";}catch{return"";}
 let photo='';try{const image=new URL(a.image);if(image.protocol==='https:'&&!image.username&&!image.password)photo='<img class="news-photo" src="'+esc(image.href)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';}catch{}
 return '<article class="news-item">'+photo+'<p class="news-meta">'+esc(a.publisher)+" · "+esc(a.publishedDate||"Publication time unavailable")+(a.symbol?" · "+esc(a.symbol):"")+'</p><h3><a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+' ↗</a></h3>'+(a.excerpt?'<p class="news-excerpt">'+esc(a.excerpt)+'…</p>':'')+'<a class="news-read" href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">Read full article ↗</a></article>';
 }).join("");
 mount.querySelectorAll(".news-photo").forEach(photo=>photo.addEventListener("error",()=>photo.remove(),{once:true}));
 }catch(e){if(requests.get(mount)===id)status.textContent="News unavailable: "+e.message;}
}};
const btn=document.getElementById("newsLoad"),input=document.getElementById("newsSymbol");
if(btn){const load=async()=>{if(btn.disabled)return;const symbol=input?input.value.trim().toUpperCase():"";if(symbol&&!/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(symbol))return;btn.disabled=true;btn.textContent="Updating…";try{await window.CompanyNews.load(symbol,document.getElementById("newsList"),document.getElementById("newsStatus"));}finally{btn.disabled=false;btn.textContent="Refresh news ↻";}};btn.addEventListener("click",load);if(input)input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();load();}});load();}
})();