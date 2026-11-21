// In-memory Google Drive v3 + a stub of Google Identity Services (token client) for tests. No real Google calls.
export const GIS_STUB=`window.google={accounts:{oauth2:{
  initTokenClient(cfg){ return { requestAccessToken(o){ window.__gis=window.__gis||{calls:0,mode:'ok',log:[]}; const G=window.__gis; G.calls++; G.log.push({prompt:cfg.prompt,hint:(o&&o.login_hint)||cfg.login_hint||'',scope:cfg.scope,client:cfg.client_id});
    setTimeout(()=>{ if(G.mode==='closed') return cfg.error_callback&&cfg.error_callback({type:'popup_closed'}); if(G.mode==='denied') return cfg.callback({error:'access_denied'}); if(G.mode==='noscope') return cfg.callback({access_token:'tok'+G.calls,expires_in:3599,scope:'email'});
      cfg.callback({access_token:'tok'+(Date.now()%1e9)+G.calls,expires_in:3599,scope:cfg.scope,token_type:'Bearer'}); },40); } }; },
  hasGrantedAllScopes(r,s){ return String(r.scope||'').split(' ').includes(s); },
  revoke(t,cb){ (window.__gis=window.__gis||{calls:0,mode:'ok',log:[]}).revoked=t; cb&&cb(); } }}};`;
export function mockDrive({email='hanzhang.test@gmail.com',name='漢章'}={}){
  const files=new Map(); let n=0; const requests=[]; const dead=new Set(), seen=new Set(); let failNext=null;
  const now=()=>new Date(Date.now()+n).toISOString();
  const mk=(o)=>{ const id='f'+(++n)+Math.random().toString(36).slice(2,6); const f={id,version:1,modifiedTime:now(),trashed:false,parents:[],revs:[],...o}; if(f.text!=null) f.revs.push({id:'r1',text:f.text,modifiedTime:f.modifiedTime}); files.set(id,f); return f; };
  const bump=(f,text)=>{ f.version++; f.modifiedTime=now(); if(text!=null){ f.text=text; f.revs.push({id:'r'+f.version,text,modifiedTime:f.modifiedTime}); } };
  const meta=f=>({id:f.id,name:f.name,version:String(f.version),modifiedTime:f.modifiedTime,mimeType:f.mimeType});
  const parseMultipart=(body,ct)=>{ const b=ct.match(/boundary=(.+)$/)[1]; const parts=body.split('--'+b).slice(1,-1).map(p=>p.replace(/^\r\n/,'').replace(/\r\n$/,'')); const [h1,...m1]=parts[0].split('\r\n\r\n'); const [h2,...c2]=parts[1].split('\r\n\r\n'); return {meta:JSON.parse(m1.join('\r\n\r\n')),text:c2.join('\r\n\r\n')}; };
  const handler=async route=>{ await new Promise(r=>setTimeout(r,+(process.env.DRIVE_LATENCY??60))); const req=route.request(); const u=new URL(req.url()); const m=req.method(); const p=u.pathname;
    const H={'access-control-allow-origin':'*'}; const json=(s,o)=>route.fulfill({status:s,contentType:'application/json',headers:H,body:JSON.stringify(o)});
    if(m==='OPTIONS') return route.fulfill({status:204,headers:{...H,'access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    requests.push(m+' '+p+(u.search?u.search:''));
    const auth=(req.headers()['authorization']||'').replace(/^Bearer /,''); seen.add(auth); if(!/^tok\d+$/.test(auth)||dead.has(auth)) return json(401,{error:{code:401,message:'Request had invalid authentication credentials.'}});
    if(failNext){ const f=failNext; failNext=null; return json(f.status,{error:{code:f.status,message:f.message||'fail'}}); }
    let mm;
    if(p==='/drive/v3/about') return json(200,{user:{emailAddress:email,displayName:name}});
    if(p==='/drive/v3/files'&&m==='GET'){ const q=u.searchParams.get('q')||''; let list=[...files.values()].filter(f=>!f.trashed);
      if(mm=q.match(/name='([^']+)' and mimeType='application\/vnd.google-apps.folder'/)) list=list.filter(f=>f.name===mm[1]&&f.mimeType==='application/vnd.google-apps.folder');
      else if(mm=q.match(/'([^']+)' in parents/)) list=list.filter(f=>f.parents.includes(mm[1]));
      return json(200,{files:list.map(meta)}); }
    if(p==='/drive/v3/files'&&m==='POST'){ const b=JSON.parse(req.postData()||'{}'); const f=mk({name:b.name,mimeType:b.mimeType,parents:b.parents||[]}); return json(200,meta(f)); }
    if(p==='/upload/drive/v3/files'&&m==='POST'){ const {meta:md,text}=parseMultipart(req.postData(),req.headers()['content-type']); const f=mk({name:md.name,mimeType:md.mimeType,parents:md.parents||[],text}); return json(200,meta(f)); }
    if((mm=p.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/))&&m==='PATCH'){ const f=files.get(mm[1]); if(!f) return json(404,{error:{message:'File not found'}}); const {text}=parseMultipart(req.postData(),req.headers()['content-type']); bump(f,text); return json(200,meta(f)); }
    if((mm=p.match(/^\/drive\/v3\/files\/([^/]+)\/revisions\/([^/]+)$/))){ const f=files.get(mm[1]); const r=f&&f.revs.find(r=>r.id===mm[2]); return r?route.fulfill({status:200,contentType:'application/json',headers:H,body:r.text}):json(404,{error:{message:'nope'}}); }
    if((mm=p.match(/^\/drive\/v3\/files\/([^/]+)\/revisions$/))){ const f=files.get(mm[1]); return json(200,{revisions:(f?f.revs:[]).map(r=>({id:r.id,modifiedTime:r.modifiedTime,lastModifyingUser:{displayName:name}}))}); }
    if((mm=p.match(/^\/drive\/v3\/files\/([^/]+)$/))){ const f=files.get(mm[1]); if(!f) return json(404,{error:{message:'File not found'}});
      if(m==='GET'&&u.searchParams.get('alt')==='media') return route.fulfill({status:200,contentType:'application/json',headers:H,body:f.text});
      if(m==='PATCH'){ const b=JSON.parse(req.postData()||'{}'); if(b.trashed) f.trashed=true; bump(f); return json(200,meta(f)); } }
    return json(404,{error:{message:'unhandled '+m+' '+p}}); };
  const folder=()=>[...files.values()].find(f=>f.name==='MyMind'&&f.mimeType==='application/vnd.google-apps.folder'&&!f.trashed);
  const inFolder=()=>{ const fo=folder(); return fo?[...files.values()].filter(f=>f.parents.includes(fo.id)&&!f.trashed):[]; };
  return { files, requests, handler, folder, inFolder,
    mapFile:id=>inFolder().find(f=>f.name===id+'.mymind'),
    doc:id=>{ const f=inFolder().find(f=>f.name===id+'.mymind'); return f?JSON.parse(f.text):null; },
    index:()=>{ const f=inFolder().find(f=>f.name==='index.json'); return f?JSON.parse(f.text):null; },
    serverEdit(id,fn){ const f=inFolder().find(f=>f.name===id+'.mymind'); const d=JSON.parse(f.text); fn(d); bump(f,JSON.stringify(d)); },
    serverPut(doc){ let fo=folder(); if(!fo) fo=mk({name:'MyMind',mimeType:'application/vnd.google-apps.folder'}); mk({name:doc.id+'.mymind',mimeType:'application/json',parents:[fo.id],text:JSON.stringify(doc)}); },
    expireAll(){ for(const t of seen) dead.add(t); }, failNext:f=>failNext=f,
    count:(re)=>requests.filter(r=>re.test(r)).length };
}
