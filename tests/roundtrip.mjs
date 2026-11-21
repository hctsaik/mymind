// Real read/write round-trip against the private data repo, in 手動同步 mode.
// Token comes ONLY from the environment (GH_TOKEN) and is injected into an in-memory browser context; never written to disk.
//   GH_TOKEN=$(gh auth token) BASE=https://hctsaik.github.io/mymind/ node tests/roundtrip.mjs
import { chromium } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const REPO=process.env.REPO||'hctsaik/mymind-data'; const TOKEN=process.env.GH_TOKEN;
if(!TOKEN){ console.error('GH_TOKEN env var required'); process.exit(2); }
const api=async(m,p,body)=>{ const r=await fetch('https://api.github.com'+p,{method:m,headers:{Authorization:'Bearer '+TOKEN,Accept:'application/vnd.github+json'},body:body&&JSON.stringify(body)}); return {status:r.status,json:r.status===204?null:await r.json().catch(()=>null)}; };
const getDoc=async path=>{ const g=await api('GET',`/repos/${REPO}/contents/${path}?ref=main&_=${Date.now()}`); return g.status===200?{doc:JSON.parse(Buffer.from(g.json.content,'base64').toString()),sha:g.json.sha}:null; };
const poll=async(fn,ms=30000)=>{ const t=Date.now(); while(Date.now()-t<ms){ const v=await fn(); if(v) return v; await new Promise(r=>setTimeout(r,1500)); } return null; };
const results=[]; const ok=(n,c,i='')=>{results.push({n,pass:!!c});console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const b=await chromium.launch({executablePath:exe});
const ctx=await b.newContext({viewport:{width:1280,height:800}}); // no storageState / userDataDir: memory only
await ctx.addInitScript(([t,repo])=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.setItem('mymind.prefs',JSON.stringify({mode:'github',repo,sync:'manual'})); localStorage.setItem('mymind.pat',JSON.stringify(t)); },[TOKEN,REPO]);
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const settle=async()=>{ await p.waitForTimeout(200); await p.evaluate(()=>window.__mmStore.syncNow({push:false})); };
const headSha=async()=>(await api('GET',`/repos/${REPO}/git/ref/heads/main`)).json.object.sha;
await p.goto(BASE); await p.waitForSelector('body[data-ready="1"]'); await p.waitForTimeout(1500);
const stamp=new Date().toISOString().slice(0,19);
await p.click('[data-act="new"] >> nth=0'); await p.waitForTimeout(300); await p.keyboard.type('往返測試 A '+stamp); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
const idA=await p.evaluate(()=>window.__mm.doc.id);
await p.goto(BASE+'#/'); await p.waitForTimeout(300); await p.click('[data-act="new"] >> nth=0'); await p.waitForTimeout(300); await p.keyboard.type('往返測試 B '+stamp); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
const idB=await p.evaluate(()=>window.__mm.doc.id); const pA=`maps/${idA}.json`, pB=`maps/${idB}.json`;
await p.waitForTimeout(1500);
ok('manual: nothing on GitHub before 同步', !(await getDoc(pA))&&!(await getDoc(pB)));
const badge=await p.locator('.top .syncbtn .nbadge').textContent().catch(()=>''); ok('同步 badge shows 2', badge==='2', badge);
const h0=await headSha();
await p.click('.top .syncbtn'); await settle();
const both=await poll(async()=>{ const a=await getDoc(pA), bb=await getDoc(pB); return a&&bb?{a,b:bb}:null; });
ok('同步: both maps written', both&&both.a.doc.root.t.startsWith('往返測試 A')&&both.b.doc.root.t.startsWith('往返測試 B'));
const cm=await api('GET',`/repos/${REPO}/commits?sha=main&per_page=3`); const c0=cm.json[0];
const det=await api('GET',`/repos/${REPO}/commits/${c0.sha}`);
ok('同步: ONE commit for both maps (parent = previous head)', det.json.files.length===2&&det.json.parents[0].sha===h0, `${det.json.files.length} files · ${c0.commit.message}`);
ok('local sha = GitHub blob sha', await p.evaluate(id=>window.__mmStore.maps.meta(id).sha,idA)===both.a.sha);
// edit + Ctrl+S
await p.goto(BASE+'#/map/'+idA); await p.waitForTimeout(400); await p.locator('#cv').focus(); await p.keyboard.press('Tab'); await p.keyboard.type('從瀏覽器新增的子節點'); await p.keyboard.press('Enter');
await p.keyboard.press('Control+s'); await settle();
const upd=await poll(async()=>{ const a=await getDoc(pA); return a&&a.doc.root.c.some(c=>c.t==='從瀏覽器新增的子節點')?a:null; }); ok('Ctrl+S: edit pushed', !!upd);
// external edit → app pulls it (fresh page in same in-memory context)
upd.doc.root.c[0].t='從 API 修改'; const put=await api('PUT',`/repos/${REPO}/contents/${pA}`,{message:'往返測試：外部修改',content:Buffer.from(JSON.stringify(upd.doc)).toString('base64'),sha:upd.sha}); ok('external edit via API', put.status===200);
const p2=await ctx.newPage(); p2.on('pageerror',e=>errs.push(e.message)); const r2=[]; p2.on('request',r=>{ if(r.url().includes('api.github.com')) r2.push(r.method()+' '+r.url().replace('https://api.github.com/repos/'+REPO,'')+' @'+Date.now()%100000); }); p2.on('response',r=>{ if(r.url().includes('api.github.com')) r2.push('  ← '+r.status()); }); await p2.goto(BASE+'#/'); await p2.waitForSelector('body[data-ready="1"]'); await p2.waitForTimeout(500);
await p2.click('#side .syncbtn'); await p2.evaluate(()=>window.__mmStore.syncNow({push:false}));
await p2.goto(BASE+'#/map/'+idA); await p2.waitForTimeout(800);
const dbg=await p2.evaluate(id=>({t:window.__mm.doc&&window.__mm.doc.root.c[0].t,meta:window.__mmStore.maps.meta(id),sync:window.__mm.sync,dlg:window.__mm.dialog&&window.__mm.dialog.type}),idA);
const lst=await api('GET',`/repos/${REPO}/contents/maps?_=${Date.now()}`);
ok('read: 同步 pulls the external change', dbg.t==='從 API 修改', JSON.stringify({dbg,remoteSha:lst.json.find(f=>f.path===pA)?.sha,putSha:put.json.content.sha,r2}));
await p2.click('[data-act="history"]'); await p2.waitForTimeout(2500); ok('history panel shows commits', await p2.locator('.hist li').count()>=3, String(await p2.locator('.hist li').count()));
await p2.screenshot({path:(process.env.SHOTS||'/workspace/mymind/app-shots')+'/22-live-history.png'});
// clean up through the app: trash → permanent delete both → 同步 (one commit), then confirm 404
await p2.goto(BASE+'#/'); await p2.waitForTimeout(400);
for(const id of [idA,idB]){ await p2.click(`[data-act="cardMenu"][data-v="${id}"]`); await p2.waitForTimeout(200); await p2.click(`[data-act="trashMap"][data-v="${id}"]`); await p2.waitForTimeout(300); }
await p2.goto(BASE+'#/trash'); await p2.waitForTimeout(400);
for(const id of [idA,idB]){ await p2.click(`[data-act="cardMenu"][data-v="${id}"]`); await p2.waitForTimeout(200); await p2.click(`[data-act="purgeMap"][data-v="${id}"]`); await p2.waitForTimeout(200); await p2.click('[data-act="promptOk"]'); await p2.waitForTimeout(300); }
await p2.click('#side .syncbtn'); await p2.waitForTimeout(200); await p2.evaluate(()=>window.__mmStore.syncNow({push:false}));
let gone=await poll(async()=>!(await getDoc(pA))&&!(await getDoc(pB)),20000);
ok('cleanup via app: both test maps deleted (404)', gone);
if(!gone){ for(const path of [pA,pB]){ const d=await getDoc(path); if(d) await api('DELETE',`/repos/${REPO}/contents/${path}`,{message:'往返測試：刪除測試圖',sha:d.sha}); } console.log('fallback cleanup via API done'); }
ok('no runtime errors', errs.length===0, errs.join('|'));
await b.close(); const f=results.filter(r=>!r.pass).length; console.log(`${results.length-f}/${results.length} passed`); process.exit(f?1:0);
