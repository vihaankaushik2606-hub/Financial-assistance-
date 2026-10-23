'use strict';
const {randomUUID,createHmac,timingSafeEqual}=require('node:crypto');
const NAME='finance_market_browser';
function browserIdentity(req,res,secret){
 if(!secret){const e=new Error('Market access is temporarily unavailable.');e.status=503;throw e;}
 const sign=id=>createHmac('sha256',secret).update('market-browser:'+id).digest('hex');
 const cookie=String(req.headers?.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(NAME+'='))?.slice(NAME.length+1)||'';
 const [id,signature]=cookie.split('.');
 if(/^[a-f0-9-]{36}$/.test(id||'')&&/^[a-f0-9]{64}$/.test(signature||'')&&timingSafeEqual(Buffer.from(sign(id),'hex'),Buffer.from(signature,'hex')))return id;
 const fresh=randomUUID();res.append('Set-Cookie',NAME+'='+fresh+'.'+sign(fresh)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800');return fresh;
}
module.exports={browserIdentity};
