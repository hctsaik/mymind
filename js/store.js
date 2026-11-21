// Local persistence. Settings, secrets and the offline map cache live ONLY in this browser's localStorage.
const K='mymind.';
const get=(k,d)=>{try{const v=localStorage.getItem(K+k);return v==null?d:JSON.parse(v);}catch{return d;}};
const set=(k,v)=>{try{localStorage.setItem(K+k,JSON.stringify(v));}catch(e){console.warn('localStorage full?',e);}};
const del=k=>localStorage.removeItem(K+k);
export const prefs={
  get:()=>{ const p={mode:null,sync:null,repo:'hctsaik/mymind-data',model:'gpt-4o-mini',lines:'standard',ui:'light',reduceMotion:false,minimap:false,hints:true,lastBackup:null,...get('prefs',{})};
    // sync: 'local' (browser only) | 'manual' | 'auto'. New users: local. Users who connected GitHub before this setting existed: manual.
    if(!p.sync) p.sync=p.mode==='github'&&get('pat','')?'manual':'local'; return p; },
  set:p=>set('prefs',{...prefs.get(),...p})
};
// secrets: separate keys, never exported, never sent anywhere except their own API host
export const secrets={
  pat:()=>get('pat',''), setPat:v=>v?set('pat',v):del('pat'),
  openai:()=>get('openai',''), setOpenai:v=>v?set('openai',v):del('openai'),
  clear:()=>{del('pat');del('openai');}
};
// Map storage: IndexedDB (database "mymind", store "kv"), mirrored in memory so reads stay synchronous.
// Keys: "index" (metadata list), "map.<id>" (document), "base.<id>" (last version known to be on GitHub, for 3-way merge),
// "deletes" (ids to remove from GitHub on the next sync). Secrets and settings stay in localStorage (see above).
// meta: {id,title,icon,theme,updated,created,star,trashed,trashedAt,sha,dirty,remote}
const mem=new Map(); let db=null, backend='memory', writes=Promise.resolve();
const clone=v=>v==null?v:structuredClone(v);
function idb(){ return new Promise((res,rej)=>{ if(!('indexedDB' in self)) return rej(new Error('no indexedDB'));
  const r=indexedDB.open('mymind',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); r.onblocked=()=>rej(new Error('blocked')); }); }
const tx=(mode,fn)=>new Promise((res,rej)=>{ const t=db.transaction('kv',mode); const st=t.objectStore('kv'); const out=fn(st); t.oncomplete=()=>res(out&&out.result); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); });
function persist(k,v){ // queue writes in order; memory is already updated
  if(backend==='idb') writes=writes.then(()=>tx('readwrite',st=>v===undefined?st.delete(k):st.put(v,k))).catch(e=>{console.warn('IndexedDB write failed',e); writes=Promise.resolve();});
  else if(backend==='local'){ try{ v===undefined?localStorage.removeItem(K+k):localStorage.setItem(K+k,JSON.stringify(v)); }catch(e){console.warn('localStorage full?',e);} } }
const mget=(k,d)=>mem.has(k)?mem.get(k):d;
const mset=(k,v)=>{ if(v===undefined) mem.delete(k); else mem.set(k,v); persist(k,v); };
export const storage={
  get backend(){return backend;},
  async init(){ // load everything into memory; migrate the old localStorage cache (v1) into IndexedDB
    try{ db=await idb(); backend='idb';
      const all=await new Promise((res,rej)=>{ const t=db.transaction('kv','readonly'), st=t.objectStore('kv'), ks=st.getAllKeys(), vs=st.getAll(); t.oncomplete=()=>res(ks.result.map((k,i)=>[k,vs.result[i]])); t.onerror=()=>rej(t.error); });
      all.forEach(([k,v])=>mem.set(k,v)); }
    catch(e){ console.warn('IndexedDB unavailable, using localStorage',e); backend='local';
      for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(/^mymind\.(index|deletes|map\.|base\.)/.test(k)) try{mem.set(k.slice(K.length),JSON.parse(localStorage.getItem(k)));}catch{} } return; }
    const legacy=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(/^mymind\.(index|map\.|base\.)/.test(k)) legacy.push(k); }
    if(legacy.length){ let idx=mget('index',[]);
      for(const k of legacy){ let v; try{v=JSON.parse(localStorage.getItem(k));}catch{continue;} const kk=k.slice(K.length);
        if(kk==='index'){ for(const m of v){ const i=idx.findIndex(x=>x.id===m.id); if(i<0) idx.push(m); else idx[i]={...idx[i],...m}; } } else mset(kk,v); }
      mset('index',idx); await writes; legacy.forEach(k=>localStorage.removeItem(k)); } },
  flush:()=>writes,
  async persisted(){ try{ return navigator.storage&&navigator.storage.persisted?await navigator.storage.persisted():false; }catch{return false;} },
  async persist(){ try{ return navigator.storage&&navigator.storage.persist?await navigator.storage.persist():false; }catch{return false;} },
  async estimate(){ try{ return navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():null; }catch{return null;} }
};
export const maps={
  index:()=>clone(mget('index',[])),
  saveIndex:a=>mset('index',clone(a)),
  meta:id=>clone(mget('index',[]).find(m=>m.id===id)),
  setMeta:(id,patch)=>{const a=maps.index();const i=a.findIndex(m=>m.id===id);if(i<0)a.push({id,...patch});else a[i]={...a[i],...patch};maps.saveIndex(a);return a.find(m=>m.id===id);},
  load:id=>clone(mget('map.'+id,null)),
  save:(id,doc)=>mset('map.'+id,clone(doc)),
  base:id=>clone(mget('base.'+id,null)),
  saveBase:(id,doc)=>mset('base.'+id,clone(doc)),
  remove:id=>{mset('map.'+id,undefined);mset('base.'+id,undefined);maps.saveIndex(maps.index().filter(m=>m.id!==id));},
  deletes:()=>clone(mget('deletes',[])),
  setDeletes:a=>mset('deletes',[...new Set(a)]),
  dirtyCount:()=>mget('index',[]).filter(m=>m.dirty).length+mget('deletes',[]).length
};
export const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
