// Real read/write round-trip against the private data repo.
// Token comes ONLY from the environment (GH_TOKEN) and is injected into an in-memory browser context; never written to disk.
//   GH_TOKEN=$(gh auth token) BASE=https://hctsaik.github.io/mymind/ node tests/roundtrip.mjs
import { chromium } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const REPO=process.env.REPO||'hctsaik/mymind-data'; const TOKEN=process.env.GH_TOKEN;
if(!TOKEN){ console.error('GH_TOKEN env var required'); process.exit(2); }
const api=async(m,p,body)=>{ const r=await fetch('https://api.github.com'+p,{method:m,headers:{Authorization:'Bearer '+TOKEN,Accept:'application/vnd.github+json'},body:body&&JSON.stringify(body)}); return {status:r.status,json:r.status===204?null:await r.json().catch(()=>null)}; };
const results=[]; const ok=(n,c,i='')=>{results.push({n,pass:!!c});console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const b=await chromium.launch({executablePath:exe});
const ctx=await b.newContext({viewport:{width:1280,height:800}}); // no storageState / userDataDir: memory only
await ctx.addInitScript(([t,repo])=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.setItem('mymind.prefs',JSON.stringify({mode:'github',repo})); localStorage.setItem('mymind.pat',JSON.stringify(t)); },[TOKEN,REPO]);
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE); await p.waitForSelector('body[data-ready="1"]'); await p.waitForTimeout(1500);
const title='往返測試 '+new Date().toISOString().slice(0,19);
await p.click('[data-act="new"]'); await p.waitForTimeout(300); await p.keyboard.type(title); await p.keyboard.press('Enter');
await p.keyboard.press('Control+s'); await p.waitForFunction(()=>/已儲存/.test(document.querySelector('.top .saved')?.textContent||''),null,{timeout:20000}).catch(()=>{});
const id=await p.evaluate(()=>window.__mm.doc.id); const path=`maps/${id}.json`;
let g=await api('GET',`/repos/${REPO}/contents/${path}`); const remote1=g.status===200?JSON.parse(Buffer.from(g.json.content,'base64').toString()):null;
ok('write: map file created in repo', remote1&&remote1.root.t===title, path);
await p.keyboard.press('Tab'); await p.keyboard.type('從瀏覽器新增的子節點'); await p.keyboard.press('Enter'); await p.keyboard.press('Control+s');
let remote2; for(let i=0;i<20;i++){ await p.waitForTimeout(1500); g=await api('GET',`/repos/${REPO}/contents/${path}?ref=main&_=${Date.now()}`); remote2=JSON.parse(Buffer.from(g.json.content,'base64').toString()); if(remote2.root.c.some(c=>c.t==='從瀏覽器新增的子節點')) break; }
ok('update: edit pushed', remote2.root.c.some(c=>c.t==='從瀏覽器新增的子節點'));
// external edit → app pulls it
remote2.root.c[0].t='從 API 修改'; const put=await api('PUT',`/repos/${REPO}/contents/${path}`,{message:'往返測試：外部修改',content:Buffer.from(JSON.stringify(remote2)).toString('base64'),sha:g.json.sha});
ok('external edit via API', put.status===200);
const p2=await ctx.newPage(); await p2.goto(BASE+'#/'); await p2.waitForSelector('body[data-ready="1"]'); await p2.waitForTimeout(2500); await p2.goto(BASE+'#/map/'+id); await p2.waitForTimeout(800);
ok('read: app pulls external change', await p2.evaluate(()=>window.__mm.doc&&window.__mm.doc.root.c[0].t)==='從 API 修改');
const cm=await api('GET',`/repos/${REPO}/commits?path=${encodeURIComponent(path)}`); ok('history: ≥3 commits for the file', cm.json.length>=3, String(cm.json.length));
await p2.click('[data-act="history"]'); await p2.waitForTimeout(2500); ok('history panel shows commits', await p2.locator('.hist li').count()>=3);
await p2.screenshot({path:(process.env.SHOTS||'/workspace/mymind/app-shots')+'/20-live-history.png'});
// clean up: delete the test map through the app (trash → permanent delete), then verify 404
await p2.goto(BASE+'#/'); await p2.waitForTimeout(500);
await p2.evaluate(()=>{});
const del=await api('GET',`/repos/${REPO}/contents/${path}`); const rm=await api('DELETE',`/repos/${REPO}/contents/${path}`,{message:'往返測試：刪除測試圖',sha:del.json.sha});
const after=await api('GET',`/repos/${REPO}/contents/${path}`); ok('cleanup: test map deleted (404)', (rm.status===200)&&after.status===404);
ok('no runtime errors', errs.length===0, errs.join('|'));
await b.close(); const f=results.filter(r=>!r.pass).length; console.log(`${results.length-f}/${results.length} passed`); process.exit(f?1:0);
