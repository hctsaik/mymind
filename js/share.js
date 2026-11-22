// Read-only share links (v1.8). No server of ours is involved:
// 1. a snapshot of one map (with its own images and look) is compressed (deflate-raw) and encrypted (AES-GCM, random 128-bit key);
// 2. it is stored as a small Google Sheet in the owner's Drive folder "MyMind", shared as "anyone with the link can view"
//    (Google serves such Sheets as CSV with CORS, so view.html can read them without any sign-in or API key);
// 3. the link is  view.html#s=<sheet id>.<key>. The #fragment is never sent to any server, so Google only ever holds ciphertext.
// Stopping a share deletes that Sheet, so the link stops working. Updating rewrites the same Sheet, so the link stays the same.
// Without Google, an "inline" link carries the compressed map itself:  view.html#z=<data>  (cannot be revoked).
export const SHARE_FMT='mymind-share/1';
export const CHUNK=30000; // Google Sheets allows 50,000 characters per cell; one chunk per row
export class ShareError extends Error{ constructor(code,msg){ super(msg||code); this.code=code; } }
export const b64u={
  enc(u8){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); },
  dec(s){ s=String(s).replace(/-/g,'+').replace(/_/g,'/'); s+='='.repeat((4-s.length%4)%4); const b=atob(s), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; } };
const pipe=async(u8,T)=>new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(T)).arrayBuffer());
const aesKey=(k,use)=>crypto.subtle.importKey('raw',b64u.dec(k),{name:'AES-GCM'},false,[use]);
export const newKey=()=>b64u.enc(crypto.getRandomValues(new Uint8Array(16)));
// what the recipient gets: the map itself (tree, theme, layout settings, the map's own look and images) and nothing else
export function snapshot(doc,at=new Date().toISOString()){
  return {format:SHARE_FMT,title:doc.root.t,icon:doc.icon||'🧠',theme:doc.theme,settings:doc.settings||{},updated:doc.updated,at,root:JSON.parse(JSON.stringify(doc.root))}; }
export async function seal(obj,key){ const z=await pipe(new TextEncoder().encode(JSON.stringify(obj)),new CompressionStream('deflate-raw'));
  if(!key) return b64u.enc(z);
  const iv=crypto.getRandomValues(new Uint8Array(12)), c=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(key,'encrypt'),z));
  const out=new Uint8Array(12+c.length); out.set(iv); out.set(c,12); return b64u.enc(out); }
export async function unseal(str,key){ let u;
  try{ u=b64u.dec(str); if(key) u=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:u.subarray(0,12)},await aesKey(key,'decrypt'),u.subarray(12))); }
  catch{ throw new ShareError('bad','連結不完整或已損壞：請向分享的人再要一次連結'); }
  let o; try{ o=JSON.parse(new TextDecoder().decode(await pipe(u,new DecompressionStream('deflate-raw')))); }catch{ throw new ShareError('bad','連結不完整或已損壞：請向分享的人再要一次連結'); }
  if(!o||o.format!==SHARE_FMT||!o.root) throw new ShareError('bad','這不是 MyMind 的分享連結'); return o; }
// one chunk per CSV row: "mms1:<i>:<n>:<data>" (letters first, so Sheets keeps every cell as plain text)
export function toCsv(s){ const n=Math.max(1,Math.ceil(s.length/CHUNK)), rows=[]; for(let i=0;i<n;i++) rows.push(`mms1:${i+1}:${n}:${s.slice(i*CHUNK,(i+1)*CHUNK)}`); return rows.join('\r\n')+'\r\n'; }
export function fromCsv(text){ const got=[]; let n=0;
  for(const line of String(text).split(/\r?\n/)){ const cell=line.split(',')[0].trim().replace(/^"|"$/g,''); const m=cell.match(/^mms1:(\d+):(\d+):([A-Za-z0-9_-]*)$/); if(!m) continue; n=+m[2]; got[+m[1]-1]=m[3]; }
  if(!n||got.length!==n||Array.from({length:n},(_,i)=>got[i]).some(x=>x===undefined)) throw new ShareError('bad','分享的內容不完整'); return got.join(''); }
export const viewerUrl=base=>new URL('view.html',base).href;
export const driveLink=(base,fid,key)=>`${viewerUrl(base)}#s=${fid}.${key}`;
export const inlineLink=(base,data)=>`${viewerUrl(base)}#z=${data}`;
export function parseLink(hash){ const h=String(hash||'').replace(/^#/,''); let m;
  if((m=h.match(/^s=([A-Za-z0-9_-]{10,})\.([A-Za-z0-9_-]{22})$/))) return {kind:'drive',fid:m[1],key:m[2]};
  if((m=h.match(/^z=([A-Za-z0-9_-]{8,})$/))) return {kind:'inline',data:m[1]}; return null; }
// anonymous read of a public Sheet (no cookies, no key); the gviz endpoint is a second route to the same cells
export const sheetUrls=fid=>[`https://docs.google.com/spreadsheets/d/${fid}/export?format=csv`,`https://docs.google.com/spreadsheets/d/${fid}/gviz/tq?tqx=out:csv`];
export async function fetchShared(fid){ let last=null;
  for(const u of sheetUrls(fid)){ try{ const r=await fetch(u,{credentials:'omit',cache:'no-store',redirect:'follow'});
      if(!r.ok){ last=new ShareError(r.status===404||r.status===403||r.status===401||r.status===410?'gone':'net'); continue; }
      return fromCsv(await r.text()); }
    catch(e){ last=e instanceof ShareError?e:new ShareError(navigator.onLine===false?'offline':'gone'); } }
  throw last||new ShareError('gone'); }
export async function loadShared(link){ const L=typeof link==='string'?parseLink(link):link; if(!L) throw new ShareError('bad','這不是 MyMind 的分享連結');
  return L.kind==='inline'?unseal(L.data,null):unseal(await fetchShared(L.fid),L.key); }
