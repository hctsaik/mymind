// PWA tests: offline app shell, installability, update prompt.
// Local (default): serves a temp copy of the app so it can publish a "new version" mid-test.
// Live: BASE=https://hctsaik.github.io/mymind/ node tests/pwa.mjs  (offline + installability only)
import { chromium } from 'playwright-core'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const SHOTS=process.env.SHOTS||'/workspace/mymind/app-shots';
const results=[]; const ok=(name,cond,info='')=>{results.push({name,pass:!!cond,info});console.log((cond?'PASS ':'FAIL ')+name+(info&&!cond?' — '+info:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
let BASE=process.env.BASE, server=null, dir=null; const live=!!BASE;
if(!live){ dir=fs.mkdtempSync(path.join(os.tmpdir(),'mymind-pwa-')); for(const f of ['index.html','sw.js','manifest.webmanifest','css','js','icons']) fs.cpSync(path.join(ROOT,f),path.join(dir,f),{recursive:true});
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
  server=http.createServer((q,r)=>{ let u=decodeURIComponent(new URL(q.url,'http://x').pathname); if(u.endsWith('/')) u+='index.html'; const f=path.join(dir,u); if(!f.startsWith(dir)||!fs.existsSync(f)){ r.writeHead(404); return r.end(); } r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream','cache-control':'max-age=600'}); fs.createReadStream(f).pipe(r); });
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); BASE=`http://localhost:${server.address().port}/`; }
const bump=v=>{ for(const [f,re,rep] of [['sw.js',/const VERSION='[^']+'/,`const VERSION='${v}'`],['js/version.js',/VERSION='[^']+'/,`VERSION='${v}'`]]){ const p=path.join(dir,f); fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(re,rep)); } };
async function run(vp,mobile,tag){
  // a persistent (non-incognito) profile: Chrome never offers install in incognito
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'mymind-prof-'));
  const ctx=await chromium.launchPersistentContext(prof,{executablePath:exe,viewport:vp,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}); const p=ctx.pages()[0]||await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/fonts\.g|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await ctx.addInitScript(()=>{ if(!localStorage['mymind.prefs']) localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'})); });
  await p.goto(BASE); await p.waitForSelector('body[data-ready="1"]');
  await p.evaluate(()=>navigator.serviceWorker.ready); await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:10000}).catch(()=>{});
  const v0=await p.evaluate(()=>window.__mmVersion);
  ok(`[${tag}] service worker installed and controlling the page`, await p.evaluate(()=>!!navigator.serviceWorker.controller));
  const keys=await p.evaluate(async()=>{ const ks=await caches.keys(); const c=await caches.open(ks.find(k=>k.startsWith('mymind-'))); return {ks,n:(await c.keys()).map(r=>new URL(r.url).pathname)}; });
  ok(`[${tag}] app shell cached as mymind-${v0}`, keys.ks.includes('mymind-'+v0)&&['js/app.js','css/app.css','index.html','icons/icon-512.png'].every(f=>keys.n.some(u=>u.endsWith(f))), JSON.stringify(keys).slice(0,200));
  const cdp=await ctx.newCDPSession(p);
  const inst=await cdp.send('Page.getInstallabilityErrors').catch(e=>({err:e.message}));
  ok(`[${tag}] installable (Chrome reports no installability errors)`, inst.installabilityErrors&&inst.installabilityErrors.length===0, JSON.stringify(inst));
  const man=await cdp.send('Page.getAppManifest').catch(e=>({err:e.message}));
  ok(`[${tag}] manifest parses without errors`, man.url&&man.url.endsWith('manifest.webmanifest')&&(man.errors||[]).length===0, JSON.stringify(man.errors||man.err));
  // make a map, then go offline and reload
  await p.locator('[data-act="mdImport"]:visible').first().click(); await W(150); await p.fill('#md-in','# 離線測試\n- 甲\n- 乙'); await p.click('#md-ok'); await W(500);
  await ctx.setOffline(true); await p.goto(BASE+'#/'); await p.reload(); await p.waitForSelector('body[data-ready="1"]',{timeout:10000}).catch(()=>{});
  ok(`[${tag}] works offline: app loads and shows saved maps`, await p.locator('body[data-ready="1"]').count()===1&&/離線測試/.test(await p.locator('main').textContent()));
  await p.locator('.card a.thumb').first().click(); await W(400);
  ok(`[${tag}] offline: map opens and is editable`, await p.locator('#mapsvg g.node').count()===3);
  await ctx.setOffline(false);
  if(!live){ // publish a new version and check the update prompt
    const nv=tag==='desktop'?'9.9.1':'9.9.2'; bump(nv); fs.appendFileSync(path.join(dir,'css/app.css'),`\n/* release ${nv} */\n`);
    await p.evaluate(()=>window.__mmPWA.reg.update()); await p.waitForSelector('#updbar',{timeout:15000}).catch(()=>{}); await W(500);
    const txt=await p.locator('#updbar').textContent().catch(()=>'');
    ok(`[${tag}] new version shows 「有新版本，重新整理」 with version`, /有新版本 v9\.9\.\d/.test(txt)&&/重新整理/.test(txt), txt);
    ok(`[${tag}] old version keeps running until the user taps`, await p.evaluate(()=>window.__mmVersion)===v0);
    const bb=await p.locator('#updbar [data-act="swReload"]').boundingBox(); ok(`[${tag}] update button ≥ ${mobile?44:36}px tall`, bb&&bb.height>=(mobile?44:36), JSON.stringify(bb));
    await p.screenshot({path:`${SHOTS}/${tag==='desktop'?'36-update-prompt-desktop':'37-update-prompt-mobile'}.png`});
    await Promise.all([p.waitForEvent('load',{timeout:15000}).catch(()=>null),p.click('#updbar [data-act="swReload"]')]); await p.waitForSelector('body[data-ready="1"]'); await W(500);
    ok(`[${tag}] 重新整理 loads the new version`, await p.evaluate(()=>window.__mmVersion)===nv, await p.evaluate(()=>window.__mmVersion));
    ok(`[${tag}] old cache removed`, JSON.stringify(await p.evaluate(()=>caches.keys()))===JSON.stringify(['mymind-'+nv]), JSON.stringify(await p.evaluate(()=>caches.keys())));
    ok(`[${tag}] data survives the update`, await p.evaluate(()=>!!window.__mm.doc&&window.__mm.doc.root.t==='離線測試')||/離線測試/.test(await p.locator('main').textContent()));
    ok(`[${tag}] no update prompt after updating`, await p.locator('#updbar').count()===0);
  }
  ok(`[${tag}] no runtime errors`, errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close(); fs.rmSync(prof,{recursive:true,force:true}); }
await run({width:1280,height:800},false,'desktop');
if(!live){ bump('1.3.0'); }
await run({width:390,height:844},true,'mobile');
server&&server.close(); if(dir) fs.rmSync(dir,{recursive:true,force:true});
const f=results.filter(r=>!r.pass); console.log(`\n${results.length-f.length}/${results.length} passed`); process.exit(f.length?1:0);
