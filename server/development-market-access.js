"use strict";
// Temporary public development mode: no identities, accounts or daily quotas.
// Cache only public provider responses, with bounded memory and request coalescing.
function createDevelopmentMarketAccess({fetchProvider,now=()=>Date.now(),maxEntries=256}){
 const cache=new Map(),inFlight=new Map();
 return {async request(endpoint,params,_userId,ttl=3600000){
  const key=JSON.stringify([endpoint,Object.entries(params).sort(([a],[b])=>a.localeCompare(b))]);
  const saved=cache.get(key);
  const meta=(state,at)=>({endpoint,period:params.period,cache:state,updatedAt:at,reason:null});
  if(saved&&saved.until>now())return {data:saved.data,meta:meta("fresh",saved.at)};
  if(inFlight.has(key))return inFlight.get(key);
  const work=(async()=>{
   const data=await fetchProvider(endpoint,params),at=new Date(now()).toISOString();
   cache.delete(key);
   if(cache.size>=maxEntries)cache.delete(cache.keys().next().value);
   cache.set(key,{data,at,until:now()+ttl});
   return {data,meta:meta("refreshed",at)};
  })();
  inFlight.set(key,work);
  try{return await work;}finally{inFlight.delete(key);}
 }};
}
module.exports={createDevelopmentMarketAccess};
