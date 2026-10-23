(() => {
'use strict';
let client=null,owner=null;
const ready=(async()=>{try{const r=await fetch('/api/config',{cache:'no-store'});const c=await r.json();if(c.developmentOpenAccess||!c.authConfigured||!window.supabase?.createClient)return;client=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey);const result=await client.auth.getSession();owner=result.data.session?.user.id||null;client.auth.onAuthStateChange((_e,s)=>{owner=s?.user.id||null;window.dispatchEvent(new Event('research-account-changed'));});}catch{client=null;}})();
function localRead(){try{const items=JSON.parse(localStorage.getItem('finance-workspace-guest-v1')||'[]');return Array.isArray(items)?items:[];}catch{return [];}}
function localWrite(items){try{localStorage.setItem('finance-workspace-guest-v1',JSON.stringify(items.slice(0,100)));}catch{throw Error('Your browser could not save this item. Free some storage or export your notes before closing.');}}
async function identity(){await ready;return owner;}
window.ResearchStore={ready,identity,
 async token(){await ready;if(!client)return null;return (await client.auth.getSession()).data.session?.access_token||null;},
 async list(kind){await ready;if(!owner)return localRead().filter(r=>!kind||r.kind===kind);const uid=owner;let query=client.from('research_items').select('id,kind,item_key,title,payload,updated_at').eq('user_id',uid).order('updated_at',{ascending:false}).limit(100);if(kind)query=query.eq('kind',kind);const {data,error}=await query;if(owner!==uid)throw Error('Account changed. Refresh your research.');if(error)throw Error('Cloud research could not be loaded. Please retry.');return data||[];},
 async save(kind,key,title,payload){await ready;const record={kind,item_key:key,title:String(title).slice(0,200),payload,updated_at:new Date().toISOString()};if(new TextEncoder().encode(JSON.stringify(payload)).length>58000)throw Error('This notebook is too large. Shorten the notes before syncing.');if(owner){const uid=owner;const {error}=await client.from('research_items').upsert({...record,user_id:uid},{onConflict:'user_id,kind,item_key'});if(error)throw Error('Cloud save failed. Your browser draft is unchanged. Retry before leaving.');if(owner!==uid)throw Error('Account changed during save.');return 'Saved privately to your account.';}const items=localRead().filter(r=>r.kind!==kind||r.item_key!==key);items.unshift(record);localWrite(items);return 'Saved on this browser only. Export a backup to keep a copy.';},
 async remove(kind,key){await ready;if(owner){const uid=owner;const {error}=await client.from('research_items').delete().eq('user_id',uid).eq('kind',kind).eq('item_key',key);if(error)throw Error('Could not remove cloud item.');}else localWrite(localRead().filter(r=>r.kind!==kind||r.item_key!==key));}
};
})();
