// Google Drive backend. Sign-in: Google Identity Services *token client* (no refresh token, no client secret).
// Scope: drive.file only, so MyMind can see ONLY the files it created (folder "MyMind" in the user's Drive).
// The access token lives in memory only (this tab); after it expires (~1 h) or a reload, one click reconnects.
export const GOOGLE_CLIENT_ID='269576596638-fbbrhn3k15bpa7qs1v2ntlimohv7tgl6.apps.googleusercontent.com'; // public by design
export const SCOPE='https://www.googleapis.com/auth/drive.file';
export const FOLDER='MyMind', INDEX='index.json', EXT='.mymind';
const API='https://www.googleapis.com/drive/v3', UP='https://www.googleapis.com/upload/drive/v3';
export class DriveError extends Error{constructor(status,msg){super(msg);this.status=status;}}
let tok=null, gisP=null; // tok: {access_token, exp}
export function loadGis(){ if(window.google&&google.accounts&&google.accounts.oauth2) return Promise.resolve(); if(gisP) return gisP;
  gisP=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://accounts.google.com/gsi/client'; s.async=true; s.onload=()=>res(); s.onerror=()=>{ gisP=null; s.remove(); rej(new DriveError(0,'載入不了 Google 登入，請檢查網路後再試')); }; document.head.appendChild(s); }); return gisP; }
export const hasToken=()=>!!tok&&tok.exp>Date.now()+30000;
export const tokenLeft=()=>tok?Math.max(0,tok.exp-Date.now()):0;
export function forgetToken(){ tok=null; }
export function revoke(){ const t=tok; tok=null; try{ if(t&&window.google&&google.accounts&&google.accounts.oauth2) google.accounts.oauth2.revoke(t.access_token,()=>{}); }catch{} }
// Opens Google's sign-in popup, so call it from a click. prompt '' skips the consent screen once access was granted.
export async function signIn({hint='',prompt=''}={}){ await loadGis();
  return new Promise((res,rej)=>{ let done=false; const fin=(f,v)=>{ if(done) return; done=true; f(v); };
    const c=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:SCOPE,prompt,...(hint?{login_hint:hint}:{}),
      callback:r=>{ if(!r||r.error) return fin(rej,new DriveError(401,r&&r.error==='access_denied'?'你取消了 Google 授權':'Google 授權失敗'+(r&&r.error?'（'+r.error+'）':'')));
        if(google.accounts.oauth2.hasGrantedAllScopes&&!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE)) return fin(rej,new DriveError(403,'沒有勾選 Google 雲端硬碟的權限，請再連結一次並勾選'));
        tok={access_token:r.access_token,exp:Date.now()+(+r.expires_in||3600)*1000}; fin(res,tok); },
      error_callback:e=>fin(rej,new DriveError(-1,e&&e.type==='popup_failed_to_open'?'瀏覽器擋住了 Google 登入視窗：請允許這個網站的彈出式視窗':e&&e.type==='popup_closed'?'Google 登入視窗已關閉':'Google 登入失敗'))});
    c.requestAccessToken(hint?{login_hint:hint}:{}); }); }
// Drive client with the same surface the sync engine uses for GitHub: list / blob / get / commitFiles / commits.
// "sha" for Drive is "<fileId>@<version>": Drive bumps version on every change, so a different value = changed elsewhere.
export function driveClient(){
  const req=async(method,url,{body,headers,text}={})=>{ if(!hasToken()) throw new DriveError(401,'需要重新連結 Google');
    let r; try{ r=await fetch(url,{method,headers:{Authorization:'Bearer '+tok.access_token,...(headers||{})},body,cache:'no-store'}); }catch{ throw new DriveError(0,'網路連線失敗'); }
    if(r.status===401){ tok=null; throw new DriveError(401,'Google 登入已過期'); }
    if(r.status===204) return null; if(text&&r.ok) return r.text();
    const j=await r.json().catch(()=>({})); if(!r.ok) throw new DriveError(r.status,(j.error&&j.error.message)||('HTTP '+r.status)); return j; };
  const q=s=>encodeURIComponent(s), F='id,name,version,modifiedTime';
  const tokOf=f=>`${f.id}@${f.version}`, fidOf=t=>String(t).split('@')[0];
  const nameOf=path=>path.split('/').pop().replace(/\.json$/,'')+EXT;
  let folder=null, byName=new Map();
  async function ensureFolder(){ if(folder) return folder;
    const j=await req('GET',`${API}/files?q=${q(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)&spaces=drive&pageSize=10`);
    if(j.files&&j.files.length) return folder=j.files[0].id;
    const c=await req('POST',`${API}/files?fields=id`,{headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER,mimeType:'application/vnd.google-apps.folder'})}); return folder=c.id; }
  async function listAll(){ const fid=await ensureFolder(); const out=[]; let pt='';
    do{ const j=await req('GET',`${API}/files?q=${q(`'${fid}' in parents and trashed=false`)}&fields=nextPageToken,files(${F})&spaces=drive&pageSize=200${pt?'&pageToken='+q(pt):''}`); out.push(...(j.files||[])); pt=j.nextPageToken||''; }while(pt);
    byName=new Map(out.map(f=>[f.name,f])); return out; }
  async function upload(file,name,text){ const b='mm'+Math.random().toString(36).slice(2);
    const meta=file?{}:{name,parents:[await ensureFolder()],mimeType:'application/json'};
    const body=`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${b}--`;
    const f=await req(file?'PATCH':'POST',`${UP}/files${file?'/'+file.id:''}?uploadType=multipart&fields=${F}`,{headers:{'Content-Type':'multipart/related; boundary='+b},body}); byName.set(f.name||name,f); return f; }
  return { kind:'drive',
    ensureFolder,
    async about(){ const j=await req('GET',`${API}/about?fields=user(emailAddress,displayName)`); return {email:(j.user&&j.user.emailAddress)||'',name:(j.user&&j.user.displayName)||''}; },
    async list(){ const files=await listAll(); return files.filter(f=>f.name.endsWith(EXT)).map(f=>({name:f.name.slice(0,-EXT.length)+'.json',sha:tokOf(f),date:f.modifiedTime})); },
    async blob(t){ const text=await req('GET',`${API}/files/${fidOf(t)}?alt=media`,{text:true}); return {text,sha:t}; },
    async get(path,ref){ if(ref&&ref.startsWith('rev:')){ const [,fid,rid]=ref.split(':'); return {text:await req('GET',`${API}/files/${fid}/revisions/${rid}?alt=media`,{text:true}),sha:ref}; }
      let f=byName.get(nameOf(path)); if(!f){ await listAll(); f=byName.get(nameOf(path)); } if(!f) throw new DriveError(404,'雲端找不到這張圖'); return {text:await req('GET',`${API}/files/${f.id}?alt=media`,{text:true}),sha:tokOf(f)}; },
    // Drive has no multi-file commit: write each changed map, deletions go to Drive's trash (recoverable for 30 days)
    async commitFiles(changes){ const shas={}; if(!byName.size) await listAll();
      for(const c of changes){ const name=nameOf(c.path), f=byName.get(name);
        if(c.del){ if(f){ await req('PATCH',`${API}/files/${f.id}?fields=id`,{headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})}); byName.delete(name); } continue; }
        const nf=await upload(f,name,c.text); shas[c.path]=tokOf(nf); }
      return {shas}; },
    // small index of all maps (titles, icons, dates) so the folder is readable from Drive too
    async writeIndex(list){ const text=JSON.stringify({format:'mymind-index/1',updated:new Date().toISOString(),maps:list},null,1)+'\n'; if(!byName.size) await listAll(); await upload(byName.get(INDEX),INDEX,text); },
    async commits(path){ let f=byName.get(nameOf(path)); if(!f){ await listAll(); f=byName.get(nameOf(path)); } if(!f) return [];
      const j=await req('GET',`${API}/files/${f.id}/revisions?fields=revisions(id,modifiedTime,lastModifyingUser(displayName))&pageSize=100`);
      return (j.revisions||[]).map((r,i)=>({sha:`rev:${f.id}:${r.id}`,msg:`第 ${i+1} 版 · Google 雲端硬碟`,date:r.modifiedTime,author:r.lastModifyingUser&&r.lastModifyingUser.displayName||''})).reverse(); } };
}
