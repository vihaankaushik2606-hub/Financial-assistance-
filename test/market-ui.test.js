const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('market fetches attach the signed-in token, usage is free, and stale timestamps remain visible',async()=>{
 const nodes=new Map(),calls=[];const node=()=>({textContent:'',append(){},setAttribute(){},prepend(){}}),main=node();
 const document={readyState:'complete',querySelector:()=>main,getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:()=>node()};
 const window={ResearchStore:{token:async()=>'account-token'},addEventListener(){},fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(String(url).includes('market-usage')?{signedIn:true,remaining:2,nextResetAt:'2026-01-02T00:00:00Z'}:{marketData:{reads:[{endpoint:'quote',cache:'stale',updatedAt:'2026-01-01T00:00:00Z'}]}}),{headers:{'Content-Type':'application/json'}});}};
 vm.runInNewContext(fs.readFileSync('public/market-access.js','utf8'),{window,document,location:new URL('https://finance.test/dashboard.html'),URL,Headers,setTimeout,clearTimeout});
 await window.fetch('/api/quote?symbol=AAPL');await new Promise(r=>setTimeout(r,180));
 const call=calls.find(c=>String(c.url).startsWith('/api/quote'));assert.equal(call.options.headers.get('Authorization'),'Bearer account-token');assert.match(nodes.get('marketDataFreshness').textContent,/older saved data/);assert.match(nodes.get('marketUsageStatus').textContent,/2 of 4/);
 await window.fetch('https://outside.test/api/quote');assert.equal(calls.at(-1).options.headers,undefined);
});
