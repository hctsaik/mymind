import crypto from 'node:crypto';
// ---- mock GitHub repo state ----
export function mockGH(){ const files=new Map(); const commits=[]; let fail=null;
  const sha=t=>crypto.createHash('sha1').update(t).digest('hex');
  const handler=async route=>{ const req=route.request(); const u=new URL(req.url()); const m=req.method(); const p=decodeURIComponent(u.pathname);
    const json=(s,o)=>route.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
    if(m==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    if(fail) { const f=fail; fail=null; return json(f.status,{message:f.message}); }
    if(p==='/repos/hctsaik/mymind-data') return json(200,{full_name:'hctsaik/mymind-data',private:true,permissions:{push:true}});
    if(p==='/repos/hctsaik/mymind-data/commits'){ const path=u.searchParams.get('path'); return json(200,commits.filter(c=>c.path===path).reverse().map(c=>({sha:c.sha,html_url:'#',commit:{message:c.msg,author:{name:'hctsaik',date:c.date}}}))); }
    const mm=p.match(/^\/repos\/hctsaik\/mymind-data\/contents\/(.*)$/); if(!mm) return json(404,{message:'Not Found'});
    const path=mm[1];
    if(m==='GET'){ const ref=u.searchParams.get('ref');
      if(path==='maps') return json(200,[...files.entries()].filter(([k])=>k.startsWith('maps/')).map(([k,v])=>({type:'file',name:k.slice(5),path:k,sha:v.sha})));
      if(ref){ const c=commits.find(c=>c.sha===ref&&c.path===path); return c?json(200,{sha:c.blob,content:Buffer.from(c.text).toString('base64')}):json(404,{message:'Not Found'}); }
      const f=files.get(path); return f?json(200,{sha:f.sha,content:Buffer.from(f.text).toString('base64')}):json(404,{message:'Not Found'}); }
    const body=JSON.parse(req.postData()||'{}'); const cur=files.get(path);
    if(m==='PUT'){ if(cur&&body.sha!==cur.sha) return json(409,{message:`maps/x.json does not match ${body.sha}`}); if(!cur&&body.sha) return json(422,{message:'sha wasn\'t supplied'});
      const text=Buffer.from(body.content,'base64').toString(); const s=sha(text+Date.now()); files.set(path,{sha:s,text}); const c={sha:sha('c'+s),blob:s,path,text,msg:body.message,date:new Date().toISOString()}; commits.push(c);
      return json(cur?200:201,{content:{sha:s,path},commit:{sha:c.sha}}); }
    if(m==='DELETE'){ if(!cur) return json(404,{message:'Not Found'}); files.delete(path); return json(200,{commit:{sha:'d'}}); }
    return json(405,{message:'nope'}); };
  return {files,commits,handler,failNext:f=>fail=f,serverEdit(path,fn){ const f=files.get(path); const d=JSON.parse(f.text); fn(d); const text=JSON.stringify(d); const s=sha(text+'srv'); files.set(path,{sha:s,text}); commits.push({sha:sha('c'+s),blob:s,path,text,msg:'外部修改',date:new Date().toISOString()}); }}; }
// ---- mock OpenAI ----
let aiMode='ok'; export const aiCalls=[]; export const setAiMode=m=>aiMode=m;
export async function aiHandler(route){ const req=route.request(); if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
  const body=JSON.parse(req.postData()); aiCalls.push({auth:req.headers()['authorization'],model:body.model,user:body.messages[1].content});
  const H={'access-control-allow-origin':'*'};
  if(aiMode==='401') return route.fulfill({status:401,contentType:'application/json',headers:H,body:JSON.stringify({error:{message:'Incorrect API key provided'}})});
  if(aiMode==='429') return route.fulfill({status:429,contentType:'application/json',headers:H,body:JSON.stringify({error:{message:'You exceeded your current quota'}})});
  const expand=/發想/.test(body.messages[1].content);
  const tree=expand?{t:'x',c:[{t:'AI 子題一'},{t:'AI 子題二'},{t:'AI 子題三'},{t:'AI 子題四'}]}:{t:'日本旅遊計畫',c:[{t:'行程',c:[{t:'東京'},{t:'京都'},{t:'大阪'}]},{t:'預算',c:[{t:'機票'},{t:'住宿'}]},{t:'交通',c:[{t:'JR Pass'},{t:'地鐵'}]},{t:'美食',c:[{t:'拉麵'},{t:'壽司'}]}]};
  return route.fulfill({status:200,contentType:'application/json',headers:H,body:JSON.stringify({choices:[{message:{content:JSON.stringify(tree)}}]})}); }
