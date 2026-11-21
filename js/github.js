// GitHub REST Contents API client (fine-grained PAT, Contents: read & write on the data repo only).
const API='https://api.github.com';
export class GitHubError extends Error{constructor(status,msg){super(msg);this.status=status;}}
const b64e=s=>{const b=new TextEncoder().encode(s);let bin='';for(let i=0;i<b.length;i+=0x8000)bin+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(bin);};
export const utf8len=s=>new TextEncoder().encode(s).length;
// git blob id of a text file, so we know a file's sha after a tree commit without fetching it again
export async function blobSha(text){ const body=new TextEncoder().encode(text), head=new TextEncoder().encode(`blob ${body.length}\0`); const all=new Uint8Array(head.length+body.length); all.set(head); all.set(body,head.length); const h=await crypto.subtle.digest('SHA-1',all); return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
const b64d=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g,'')),c=>c.charCodeAt(0)));
export function client(token,repo){
  const req=async(method,path,body)=>{
    let r; try{ r=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'}); }
    catch(e){ throw new GitHubError(0,'網路連線失敗'); }
    if(r.status===204) return null;
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new GitHubError(r.status,j.message||('HTTP '+r.status));
    return j;
  };
  const enc=p=>p.split('/').map(encodeURIComponent).join('/');
  return {
    repo, req,
    async test(){ const j=await req('GET',`/repos/${repo}`); return {private:j.private,push:!!(j.permissions&&j.permissions.push),full:j.full_name}; },
    async list(dir='maps'){ try{ return (await req('GET',`/repos/${repo}/contents/${enc(dir)}`)).filter(f=>f.type==='file'); }catch(e){ if(e.status===404) return []; throw e; } },
    async get(path,ref){ const j=await req('GET',`/repos/${repo}/contents/${enc(path)}${ref?'?ref='+encodeURIComponent(ref):''}`); return {text:b64d(j.content||''),sha:j.sha}; },
    // content-addressed read: never stale, unlike reading a path right after someone wrote it
    async blob(sha){ const j=await req('GET',`/repos/${repo}/git/blobs/${sha}`); return {text:b64d(j.content||''),sha:j.sha||sha}; },
    async put(path,text,sha,message){ const j=await req('PUT',`/repos/${repo}/contents/${enc(path)}`,{message,content:b64e(text),...(sha?{sha}:{})}); return {sha:j.content.sha,commit:j.commit.sha}; },
    async remove(path,sha,message){ return req('DELETE',`/repos/${repo}/contents/${enc(path)}`,{message,sha}); },
    // Several file changes in ONE commit via the git data API (ref → tree → commit → fast-forward ref; never forced).
    // changes: [{path,text}] or [{path,del:true}]
    async commitFiles(changes,message){ let br=this._br; if(!br){ const j=await req('GET',`/repos/${repo}`); br=this._br=j.default_branch||'main'; }
      const ref=await req('GET',`/repos/${repo}/git/ref/heads/${encodeURIComponent(br)}`); const head=ref.object.sha;
      const cm=await req('GET',`/repos/${repo}/git/commits/${head}`);
      const tree=await req('POST',`/repos/${repo}/git/trees`,{base_tree:cm.tree.sha,tree:changes.map(c=>c.del?{path:c.path,mode:'100644',type:'blob',sha:null}:{path:c.path,mode:'100644',type:'blob',content:c.text})});
      const nc=await req('POST',`/repos/${repo}/git/commits`,{message,tree:tree.sha,parents:[head]});
      await req('PATCH',`/repos/${repo}/git/refs/heads/${encodeURIComponent(br)}`,{sha:nc.sha,force:false});
      return {commit:nc.sha,parent:head}; },
    async commits(path){ return (await req('GET',`/repos/${repo}/commits?path=${encodeURIComponent(path)}&per_page=30`)).map(c=>({sha:c.sha,msg:c.commit.message,date:c.commit.author&&c.commit.author.date,author:c.commit.author&&c.commit.author.name,url:c.html_url})); }
  };
}
