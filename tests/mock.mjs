import crypto from 'node:crypto';
// ---- mock GitHub repo state ----
// Supports the Contents API (list/get/put/delete) and the git data API (ref → commit → tree → commit → ref) used for batched sync.
// commits: [{sha, paths:{path:{text,blob}|null}, msg, date, api}] — one entry per commit, possibly touching many files.
export const gitBlob=t=>{ const b=Buffer.from(t,'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex'); };
export function mockGH(){ const files=new Map(); const commits=[]; let fail=null; const trees=new Map(), pend=new Map(); let head='root0000'; const requests=[];
  const sha=t=>crypto.createHash('sha1').update(t).digest('hex');
  const record=(paths,msg,api)=>{ const c={sha:sha('c'+Math.random()+Date.now()),paths,msg,date:new Date().toISOString(),api,parent:head}; for(const [k,v] of Object.entries(paths)){ if(v) files.set(k,{sha:v.blob,text:v.text}); else files.delete(k); } commits.push(c); head=c.sha; return c; };
  const handler=async route=>{ await new Promise(r=>setTimeout(r,+(process.env.GH_LATENCY??250))); const req=route.request(); const u=new URL(req.url()); const m=req.method(); const p=decodeURIComponent(u.pathname);
    const json=(s,o)=>route.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
    if(m==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    requests.push(m+' '+p);
    if(fail) { const f=fail; fail=null; return json(f.status,{message:f.message}); }
    const R='/repos/hctsaik/mymind-data';
    if(p===R) return json(200,{full_name:'hctsaik/mymind-data',private:true,default_branch:'main',permissions:{push:true}});
    if(p===R+'/commits'){ const path=u.searchParams.get('path'); return json(200,commits.filter(c=>path in c.paths).reverse().map(c=>({sha:c.sha,html_url:'#',commit:{message:c.msg,author:{name:'hctsaik',date:c.date}}}))); }
    if(p===R+'/git/ref/heads/main'&&m==='GET') return json(200,{object:{sha:head}});
    let mm;
    if((mm=p.match(/\/git\/blobs\/(\w+)$/))&&m==='GET'){ let t=null; for(const f of files.values()) if(f.sha===mm[1]) t=f.text; if(t===null) for(const c of commits) for(const v of Object.values(c.paths)) if(v&&v.blob===mm[1]) t=v.text; return t===null?json(404,{message:'Not Found'}):json(200,{sha:mm[1],content:Buffer.from(t).toString('base64'),encoding:'base64'}); }
    if((mm=p.match(/\/git\/commits\/(\w+)$/))&&m==='GET') return json(200,{sha:mm[1],tree:{sha:'tree-'+mm[1]}});
    const body=m==='GET'?{}:JSON.parse(req.postData()||'{}');
    if(p===R+'/git/trees'&&m==='POST'){ const t='t'+sha(JSON.stringify(body)+Math.random()); trees.set(t,body); return json(201,{sha:t,tree:[]}); }
    if(p===R+'/git/commits'&&m==='POST'){ const c='p'+sha(JSON.stringify(body)+Math.random()); pend.set(c,body); return json(201,{sha:c}); }
    if(p===R+'/git/refs/heads/main'&&m==='PATCH'){ const pc=pend.get(body.sha); if(!pc) return json(422,{message:'Object does not exist'}); if(pc.parents[0]!==head||body.force) return json(422,{message:'Update is not a fast forward'});
      const t=trees.get(pc.tree); const paths={}; for(const e of t.tree){ if(e.sha===null){ if(!files.has(e.path)) return json(422,{message:'GitRPC::BadObjectState'}); paths[e.path]=null; } else paths[e.path]={text:e.content,blob:gitBlob(e.content)}; }
      const c=record(paths,pc.message,'git'); return json(200,{object:{sha:c.sha}}); }
    mm=p.match(/^\/repos\/hctsaik\/mymind-data\/contents\/(.*)$/); if(!mm) return json(404,{message:'Not Found'});
    const path=mm[1];
    if(m==='GET'){ const ref=u.searchParams.get('ref');
      if(path==='maps') return json(200,[...files.entries()].filter(([k])=>k.startsWith('maps/')).map(([k,v])=>({type:'file',name:k.slice(5),path:k,sha:v.sha})));
      if(ref){ const c=commits.find(c=>c.sha===ref&&c.paths[path]); return c?json(200,{sha:c.paths[path].blob,content:Buffer.from(c.paths[path].text).toString('base64')}):json(404,{message:'Not Found'}); }
      const f=files.get(path); return f?json(200,{sha:f.sha,content:Buffer.from(f.text).toString('base64')}):json(404,{message:'Not Found'}); }
    const cur=files.get(path);
    if(m==='PUT'){ if(cur&&body.sha!==cur.sha) return json(409,{message:`maps/x.json does not match ${body.sha}`}); if(!cur&&body.sha) return json(422,{message:'sha wasn\'t supplied'});
      const text=Buffer.from(body.content,'base64').toString(); const c=record({[path]:{text,blob:gitBlob(text)}},body.message,'contents'); return json(cur?200:201,{content:{sha:gitBlob(text),path},commit:{sha:c.sha}}); }
    if(m==='DELETE'){ if(!cur) return json(404,{message:'Not Found'}); record({[path]:null},body.message,'contents'); return json(200,{commit:{sha:'d'}}); }
    return json(405,{message:'nope'}); };
  return {files,commits,requests,handler,failNext:f=>fail=f,
    commitsFor:path=>commits.filter(c=>path in c.paths),
    doc:path=>files.has(path)?JSON.parse(files.get(path).text):null,
    serverEdit(path,fn){ const d=JSON.parse(files.get(path).text); fn(d); const text=JSON.stringify(d); record({[path]:{text,blob:gitBlob(text)}},'外部修改','server'); },
    serverPut(path,doc){ const text=JSON.stringify(doc); record({[path]:{text,blob:gitBlob(text)}},'另一台裝置新增','server'); } }; }
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
