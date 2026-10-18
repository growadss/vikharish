const crypto=require('node:crypto');
const PIXEL_ID='1799675524943558';
const EVENTS=new Set(['PageView','Subscribe']);
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.META_CAPI_TOKEN)return res.status(503).json({error:'META_CAPI_TOKEN is missing'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(!EVENTS.has(b.event_name)||typeof b.event_id!=='string'||!/^(pv|sub)_[\w-]{16,100}$/.test(b.event_id))return res.status(400).json({error:'Invalid event'});
 let u;try{u=new URL(b.event_source_url)}catch{return res.status(400).json({error:'Invalid source URL'})}
 const host=(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim().toLowerCase();
 if(u.hostname.toLowerCase()!==host.split(':')[0]||!['http:','https:'].includes(u.protocol))return res.status(403).json({error:'Source host mismatch'});
 const ua=req.headers['user-agent']||'';
 const ip=(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket?.remoteAddress;
 const user_data={client_user_agent:ua,client_ip_address:ip};
 if(typeof b.fbp==='string'&&b.fbp.length<200)user_data.fbp=b.fbp;
 if(typeof b.fbc==='string'&&b.fbc.length<200)user_data.fbc=b.fbc;
 const payload={data:[{event_name:b.event_name,event_time:Math.floor(Date.now()/1000),event_id:b.event_id,event_source_url:u.href,action_source:'website',user_data}]};
 if(process.env.META_TEST_EVENT_CODE)payload.test_event_code=process.env.META_TEST_EVENT_CODE;
 try{
 const response=await fetch(`https://graph.facebook.com/v25.0/${PIXEL_ID}/events`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.META_CAPI_TOKEN}`},body:JSON.stringify(payload)});
 const result=await response.json();
 if(!response.ok){console.error('Meta CAPI rejected request',response.status,JSON.stringify(result));return res.status(502).json({ok:false,error:'Meta rejected event',meta_status:response.status})}
 console.info('Meta CAPI accepted',b.event_name,'events_received',result.events_received);
 return res.status(200).json({ok:true,events_received:result.events_received||0});
 }catch(e){console.error('Meta CAPI network failure',e.message);return res.status(502).json({ok:false,error:'CAPI network failure'})}
};
