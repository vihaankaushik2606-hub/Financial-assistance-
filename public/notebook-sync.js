(() => {
'use strict';
let current=null,busy=false;
const $=id=>document.getElementById(id),status=$('notebookCloudStatus');
window.addEventListener('lab-company-reset',()=>{current=null;status.textContent='';});
window.addEventListener('lab-company-loaded',e=>{current=window.StatementAnalysis.analyze(e.detail.data);status.textContent='Use Save to account to sync. Loading a saved notebook replaces the notes shown here.';});
const key=r=>r.symbol+':'+(r.date||'undated')+':'+(r.currency||'unknown');
$('notebookCloudSave').addEventListener('click',async()=>{if(!current||busy)return;busy=true;const snapshot={...current},notes=Object.fromEntries([...document.querySelectorAll('[data-note]')].map(f=>[f.id,f.value]));status.textContent='Saving notebook…';try{const message=await window.ResearchStore.save('notebook',key(snapshot),snapshot.symbol+' notebook '+(snapshot.date||''),{symbol:snapshot.symbol,date:snapshot.date,currency:snapshot.currency,isDemo:snapshot.isDemo,notes});if(current===null||key(current)!==key(snapshot))return;status.textContent=message;}catch(e){status.textContent=e.message;}finally{busy=false;}});
$('notebookCloudLoad').addEventListener('click',async()=>{if(!current||busy)return;busy=true;const snapshot={...current};status.textContent='Loading saved notebook…';try{const items=await window.ResearchStore.list('notebook');if(!current||key(current)!==key(snapshot))return;const item=items.find(i=>i.item_key===key(snapshot));if(!item){status.textContent='No notebook was saved for this company, reporting date and currency.';return;}for(const f of document.querySelectorAll('[data-note]'))f.value=typeof item.payload?.notes?.[f.id]==='string'?item.payload.notes[f.id]:'';document.querySelector('[data-note]')?.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Saved notebook loaded. Your browser draft now matches these notes.';}catch(e){status.textContent=e.message;}finally{busy=false;}});
})();
