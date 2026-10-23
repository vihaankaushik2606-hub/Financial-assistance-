"use strict";
const {createHash}=require('node:crypto');
const MESSAGES={SIGN_IN_REQUIRED:'Sign in to request uncached market data. Saved data remains available.',ACCOUNT_LIMIT:'Your four market-data calls for the last 24 hours are used. Saved data remains available.',SITE_LIMIT:'The site’s 225-call safety limit is reached. Saved data remains available.',PROVIDER_COOLDOWN:'The provider recently failed for this data. Please try later.',REFRESH_IN_PROGRESS:'This data is being fetched by another request. Try again shortly.'};
function failure(code){const e=new Error(MESSAGES[code]||'Market data is temporarily unavailable.');e.code=code;e.status=code==='SIGN_IN_REQUIRED'?401:code==='ACCOUNT_LIMIT'||code==='SITE_LIMIT'?429:503;return e;}
function createMarketAccess({rpc,fetchProvider,now=()=>Date.now()}){
 const inFlight=new Map();
 return{async request(endpoint,params,userId,ttl){
  const key=createHash('sha256').update(JSON.stringify([endpoint,Object.entries(params).sort(([a],[b])=>a.localeCompare(b))])).digest('hex');
  const flightKey=key+':'+(userId||'guest');
  if(inFlight.has(flightKey)){const result=await inFlight.get(flightKey);return{...result,meta:{...result.meta,cache:result.meta.cache==='refreshed'?'fresh':result.meta.cache}};}
  const work=(async()=>{
  const r=await rpc({p_action:'reserve',p_key:key,p_user:userId||null});
  if(r.state==='fresh'||r.state==='stale')return{data:r.data,meta:{endpoint,period:params.period,cache:r.state,updatedAt:r.fetchedAt,reason:r.reason||null}};
  if(r.state!=='fetch')throw failure(r.reason);
  let data;
  try{data=await fetchProvider(endpoint,params);}catch(e){
   try{await rpc({p_action:'complete',p_key:key,p_lease:r.lease,p_payload:null,p_cooldown:e.status===429||e.providerStatus===403?3600:300});}catch{}
   if(r.data!==null&&r.data!==undefined)return{data:r.data,meta:{endpoint,period:params.period,cache:'stale',updatedAt:r.fetchedAt,reason:'PROVIDER_ERROR'}};
   throw e;
  }
  const updatedAt=new Date(now()).toISOString();
  // A reserved attempt is never refunded: the provider may have counted it even if a response or cache write fails.
  try{await rpc({p_action:'complete',p_key:key,p_lease:r.lease,p_payload:data,p_ttl:Math.ceil(ttl/1000)});}catch{throw failure('CACHE_SAVE_FAILED');}
  return{data,meta:{endpoint,period:params.period,cache:'refreshed',updatedAt,reason:null}};
  })();
  inFlight.set(flightKey,work);
  try{return await work;}finally{inFlight.delete(flightKey);}
 },async usage(userId){return rpc({p_action:'status',p_user:userId||null});}};
}
function createRpc({url,key,secret,guest=false,fetchImpl=fetch}){
 return async args=>{
  if(!url||!key||!secret)throw failure('CACHE_NOT_CONFIGURED');
  const payload={p_secret:secret,...args};if(guest){payload.p_guest=payload.p_user||null;delete payload.p_user;}
  const response=await fetchImpl(url.replace(/\/$/,'')+'/rest/v1/rpc/'+(guest?'market_control_guest':'market_control'),{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw failure('CACHE_UNAVAILABLE');
  return response.json();
 };
}
module.exports={createMarketAccess,createRpc};
