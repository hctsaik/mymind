// Local persistence. Settings, secrets and the offline map cache live ONLY in this browser's localStorage.
const K='mymind.';
const get=(k,d)=>{try{const v=localStorage.getItem(K+k);return v==null?d:JSON.parse(v);}catch{return d;}};
const set=(k,v)=>{try{localStorage.setItem(K+k,JSON.stringify(v));}catch(e){console.warn('localStorage full?',e);}};
const del=k=>localStorage.removeItem(K+k);
export const prefs={
  get:()=>({mode:null,repo:'hctsaik/mymind-data',model:'gpt-4o-mini',lines:'standard',ui:'light',reduceMotion:false,minimap:false,hints:true,...get('prefs',{})}),
  set:p=>set('prefs',{...prefs.get(),...p})
};
// secrets: separate keys, never exported, never sent anywhere except their own API host
export const secrets={
  pat:()=>get('pat',''), setPat:v=>v?set('pat',v):del('pat'),
  openai:()=>get('openai',''), setOpenai:v=>v?set('openai',v):del('openai'),
  clear:()=>{del('pat');del('openai');}
};
// map cache: index (metadata) + one key per map
// meta: {id,title,icon,theme,updated,created,star,trashed,trashedAt,sha,dirty,remote}
export const maps={
  index:()=>get('index',[]),
  saveIndex:a=>set('index',a),
  meta:id=>maps.index().find(m=>m.id===id),
  setMeta:(id,patch)=>{const a=maps.index();const i=a.findIndex(m=>m.id===id);if(i<0)a.push({id,...patch});else a[i]={...a[i],...patch};maps.saveIndex(a);return a.find(m=>m.id===id);},
  load:id=>get('map.'+id,null),
  save:(id,doc)=>set('map.'+id,doc),
  base:id=>get('base.'+id,null),            // last version known to be on GitHub (for 3-way merge)
  saveBase:(id,doc)=>set('base.'+id,doc),
  remove:id=>{del('map.'+id);del('base.'+id);maps.saveIndex(maps.index().filter(m=>m.id!==id));}
};
export const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
