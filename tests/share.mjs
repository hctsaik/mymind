// v1.8 read-only share links: crypto/CSV round trip, a 755-node map with ~1.3 MB of images, the share dialog on desktop and
// on a 390px phone (create → copy → open signed-out → update → stop), the viewer (same look as the app, fold/unfold, no editing),
// inline links and error pages. Google Drive and the public Sheets CSV endpoint are mocked (tests/drive-mock.mjs).
// Run: BASE=http://localhost:8765/ node tests/share.mjs   (SHOTS=dir saves screenshots)
import { chromium } from 'playwright-core';
import { mockDrive, GIS_STUB } from './drive-mock.mjs';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push([n,!!c]);console.log((c?'PASS ':'FAIL ')+n+(i&&!c?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const N=(id,t,c,x={})=>({id,t,...(c?{c}:{}),...x});
const pic=(w,h,fill)=>'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="8" fill="${fill}"/><circle cx="${w/2}" cy="${h/2}" r="${h/3}" fill="#fff"/></svg>`).toString('base64');
const gs={v:1,bg:'#f5f9fc',maxW:400,layout:'right',lv:[{fs:20,fill:'#2f6fd0',color:'#ffffff',r:8},{fs:16,fill:'#e8f0fd',color:'#1f2329',r:6},{fs:14,color:'#1f2329'}],assets:{s1:pic(40,40,'#f59e0b')}};
const docs=[
  {format:'mymind/1',id:'mdef',theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',
   root:N('d0','季度規劃',[N('d1','產品',[N('d11','新功能'),N('d12','修正',[],{note:'先修手機版'})]),N('d2','行銷',[N('d21','社群')],{collapsed:true}),N('d3','招募'),N('d4','預算',[],{link:'https://example.com/budget'})])},
  {format:'mymind/1',id:'mcls',theme:'classic',settings:{layout:'right'},icon:'🍑',created:'2026-11-01T00:00:00Z',updated:'2026-11-19T00:00:00Z',
   root:N('c0','旅行計畫',[N('c1','行程',[N('c11','第一天',[],{img:{src:pic(120,80,'#60a5fa'),w:120,h:80}}),N('c12','第二天')]),N('c2','預算',[N('c21','住宿')],{collapsed:true}),N('c3','打包',[],{gst:{k:'s1',w:40,h:40}}),N('c4','交通')],{gs})}];
const routes=async(ctx,drive)=>{ await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.route('https://fonts.gstatic.com/**',r=>r.fulfill({status:404,body:''}));
  await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:GIS_STUB}));
  await ctx.route('https://www.googleapis.com/**',drive.handler); await ctx.route('https://docs.google.com/**',drive.sheetHandler); };
const seed=async ctx=>ctx.addInitScript(({docs})=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.clear();
  localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'manual',backend:'drive',driveEmail:'someone@example.com'}));
  localStorage.setItem('mymind.index',JSON.stringify(docs.map(d=>({id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created,dirty:true})))); docs.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{docs});
const b=await chromium.launch({executablePath:exe});
const drive=mockDrive({email:'someone@example.com'});
const errs=[];
const clickAt=async(pg,id,n=1)=>{ const bx=await pg.locator(`#mapsvg g.node[data-id="${id}"] rect.hit`).boundingBox(); await pg.mouse.click(bx.x+bx.width/2,bx.y+bx.height/2,{clickCount:n}); };
// a signed-out recipient: brand-new context, no storage, no service worker, nothing seeded
async function recipient(url,{mobile=false}={}){ const ctx=await b.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1280,height:800}});
  await routes(ctx,drive); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('viewer: '+e.message)); await p.goto(url); await p.waitForFunction(()=>document.body.dataset.ready,null,{timeout:15000}); return {ctx,p}; }

// ---------- 1. format: crypto, chunks, links ----------
{ const ctx=await b.newContext(); await routes(ctx,drive); const p=await ctx.newPage(); await p.goto(BASE+'view.html'); await p.waitForFunction(()=>document.body.dataset.ready);
  ok('viewer without data explains the link is incomplete',await p.locator('.vwmsg h2').textContent()==='連結不完整');
  const r=await p.evaluate(async()=>{ const SH=await import('./js/share.js'); const out={};
    const doc={id:'x',theme:'coral',icon:'🧪',settings:{edge:'curve'},updated:'2026-01-01T00:00:00Z',star:true,source:{x:1},root:{id:'r',t:'根 <b>&',c:[{id:'a',t:'甲',collapsed:true,c:[{id:'b',t:'乙'}]}]}};
    const s=SH.snapshot(doc,'2026-02-02T00:00:00Z'); out.noPrivate=!('star' in s)&&!('source' in s)&&!('id' in s); out.fmt=s.format;
    const key=SH.newKey(); out.keyLen=key.length; const z=await SH.seal(s,key); const back=await SH.unseal(z,key); out.round=JSON.stringify(back)===JSON.stringify(s);
    try{ await SH.unseal(z,SH.newKey()); out.wrong='opened'; }catch(e){ out.wrong=e.code; }
    try{ await SH.unseal(z.slice(0,-4)+'AAAA',key); out.tamper='opened'; }catch(e){ out.tamper=e.code; }
    out.notPlain=!z.includes('甲')&&!/[\u4e00-\u9fff]/.test(atob(z.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(z.length/4)*4,'=')).slice(0,400));
    const big='x'.repeat(65000); const csv=SH.toCsv(big); out.rows=csv.trim().split('\r\n').length; out.maxRow=Math.max(...csv.split('\r\n').map(l=>l.length)); out.csvBack=SH.fromCsv(csv)===big;
    out.csvQuoted=SH.fromCsv(csv.split('\r\n').map(l=>l?`"${l}",,`:l).join('\n'))===big;
    try{ SH.fromCsv(csv.split('\r\n').slice(1).join('\r\n')); out.missing='ok'; }catch(e){ out.missing=e.code; }
    out.parse=[SH.parseLink('#s=1AbCdEfGhIjK_-.'+key),SH.parseLink('#z=abcdefgh123'),SH.parseLink('#s=short.k'),SH.parseLink('')].map(x=>x&&x.kind);
    out.link=SH.driveLink('https://hctsaik.github.io/mymind/','FID1234567890',key);
    return out; });
  ok('snapshot carries the map only (no id, star, source)',r.noPrivate&&r.fmt==='mymind-share/1');
  ok('128-bit key, base64url (22 chars)',r.keyLen===22);
  ok('seal/unseal round trip',r.round);
  ok('wrong key is refused',r.wrong==='bad'); ok('tampered data is refused',r.tamper==='bad'); ok('ciphertext has no readable text',r.notPlain);
  ok('chunks stay under the 50,000-character Sheets cell limit',r.rows===3&&r.maxRow<=30020,JSON.stringify([r.rows,r.maxRow]));
  ok('CSV round trip (plain and quoted)',r.csvBack&&r.csvQuoted); ok('missing chunk is detected',r.missing==='bad');
  ok('link parser',JSON.stringify(r.parse)===JSON.stringify(['drive','inline',null,null]),JSON.stringify(r.parse));
  ok('key is only in the #fragment',/^https:\/\/hctsaik\.github\.io\/mymind\/view\.html#s=FID1234567890\.[A-Za-z0-9_-]{22}$/.test(r.link));
  // 755 nodes with ~1.3 MB of incompressible pictures (like a big imported map)
  const big=await p.evaluate(async()=>{ const SH=await import('./js/share.js'); let k=0; const rnd=n=>{ const u=new Uint8Array(n); for(let i=0;i<n;i+=65536) crypto.getRandomValues(u.subarray(i,Math.min(n,i+65536))); let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); };
    const mk=(d)=>{ const n={id:'n'+(k++),t:'節點 '+k+' 內容說明',note:k%7?'':'備註 '+k}; if(d<3&&k<755) n.c=Array.from({length:d===0?8:d===1?9:10},()=>mk(d+1)).filter(Boolean); return n; };
    const root=mk(0); const all=[]; (function w(n){ all.push(n); (n.c||[]).forEach(w); })(root); all.slice(0,755);
    for(let i=1;i<=20;i++) all[i*10].img={src:'data:image/png;base64,'+rnd(48000),w:120,h:90};
    const doc={id:'big',theme:'classic',root,settings:{}}; const raw=JSON.stringify(doc).length; const key=SH.newKey(); const t0=performance.now();
    const csv=SH.toCsv(await SH.seal(SH.snapshot(doc),key)); const t1=performance.now(); const back=await SH.unseal(SH.fromCsv(csv),key); const t2=performance.now();
    return {nodes:all.length,raw,csv:csv.length,rows:csv.trim().split('\r\n').length,maxRow:Math.max(...csv.split('\r\n').map(l=>l.length)),same:JSON.stringify(back.root)===JSON.stringify(root),seal:Math.round(t1-t0),open:Math.round(t2-t1)}; });
  console.log('   big map:',JSON.stringify(big));
  ok(`big map (${big.nodes} nodes, ${(big.raw/1e6).toFixed(2)} MB) seals and opens intact`,big.nodes>=755&&big.raw>1.2e6&&big.same&&big.maxRow<=30020);
  await ctx.close(); }

// ---------- 2. desktop: create, copy, view signed-out, update, stop ----------
let link1='';
{ const ctx=await b.newContext({viewport:{width:1280,height:800}}); await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(BASE).origin}); await routes(ctx,drive); await seed(ctx);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('app: '+e.message)); await p.goto(BASE+'#/map/mdef'); await p.waitForSelector('#mapsvg g.node');
  const btn=p.locator('.top [data-act="share"]'); ok('desktop toolbar has 分享',await btn.isVisible()&&(await btn.textContent()).trim()==='分享');
  await btn.click(); await p.waitForSelector('.shmodal');
  const txt=await p.locator('.shmodal').textContent();
  ok('dialog says anyone with the link can view, snapshot, and can be stopped',/知道連結的人都能查看/.test(txt)&&/快照/.test(txt)&&/停止分享/.test(txt));
  ok('not signed in: button says it will connect Google',/連結 Google 並建立/.test(await p.locator('[data-act="shareCreate"]').textContent()));
  await W(300); ok('inline option offered for a small map',await p.locator('[data-act="shareInline"]').isVisible());
  if(SHOTS) await p.screenshot({path:`${SHOTS}/share-desktop-dialog.png`});
  await p.click('[data-act="shareCreate"]'); await p.waitForSelector('#sh-url',{timeout:10000}); await W(200);
  link1=await p.inputValue('#sh-url');
  const sh=drive.shares(); ok('one Sheet created in the MyMind folder',sh.length===1&&sh[0].parents.includes(drive.folder().id));
  ok('Sheet is "anyone with the link: reader", not discoverable',sh[0]&&sh[0].perms.length===1&&sh[0].perms[0].type==='anyone'&&sh[0].perms[0].role==='reader'&&sh[0].perms[0].allowFileDiscovery===false);
  ok('Sheet tagged with the map id (for other devices)',sh[0]&&sh[0].appProperties.mmShare==='mdef'&&sh[0].appProperties.mmKey.length===22);
  ok('Sheet holds ciphertext only',sh[0]&&!/季度|產品|行銷/.test(sh[0].text)&&/^mms1:1:\d+:/.test(sh[0].text));
  ok('link = view.html#s=<sheet>.<key>',link1.startsWith(BASE+'view.html#s='+sh[0].id+'.')&&!link1.includes('?'),link1);
  ok('link copied to the clipboard',await p.evaluate(()=>navigator.clipboard.readText())===link1);
  ok('toast confirms',/已建立並複製連結/.test(await p.locator('#toast').textContent()));
  ok('dialog shows 分享中 + snapshot time',/分享中：知道連結的人都能查看/.test(await p.locator('.shmodal').textContent())&&/快照 · \d{4}\/\d+\/\d+ \d\d:\d\d/.test(await p.locator('.shsnap').textContent()));
  if(SHOTS) await p.screenshot({path:`${SHOTS}/share-desktop-dialog-shared.png`});
  await p.click('.shmodal [data-act="closeDialog"]'); await W(200);
  ok('toolbar now says 分享中',(await btn.textContent()).trim()==='分享中');
  // app geometry, nothing selected, to compare with the viewer
  await p.keyboard.press('Escape'); await W(200);
  const geo=pg=>pg.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#mapsvg g.node')].map(g=>{ const r=(g.querySelector('rect.hit')||g).getBBox(); return [g.dataset.id,[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height),g.textContent.trim()]]; })));
  const appGeo=await geo(p);
  // recipient
  const R=await recipient(link1); const v=R.p;
  ok('signed-out viewer opens the map',await v.evaluate(()=>document.body.dataset.ready)==='1',await v.evaluate(()=>document.querySelector('#vw').textContent.slice(0,120))+' '+drive.requests.slice(-3).join(','));
  ok('viewer title + 唯讀 + 快照',(await v.locator('#vwt').textContent())==='季度規劃'&&/唯讀/.test(await v.locator('.vwbar').textContent())&&/快照 ·/.test(await v.locator('.vwbar').textContent()));
  const vGeo=await geo(v);
  const diff=Object.keys({...appGeo,...vGeo}).filter(k=>JSON.stringify(appGeo[k])!==JSON.stringify(vGeo[k]));
  ok('viewer draws every node exactly where the app does',diff.length===0&&Object.keys(vGeo).length===Object.keys(appGeo).length,JSON.stringify(diff.slice(0,3).map(k=>[k,appGeo[k],vGeo[k]])));
  ok('no editing UI in the viewer',await v.evaluate(()=>!document.querySelector('input,textarea,[contenteditable],[data-act="addChild"],.nodetb')));
  ok('"用 MyMind 製作" link',await v.locator('.vwmade').getAttribute('href')==='./');
  const vis=async id=>v.evaluate(id=>!!document.querySelector(`#mapsvg g.node[data-id="${id}"]`),id);
  await clickAt(v,'d1'); await W(250);
  ok('click a branch folds it',!(await vis('d11')));
  await clickAt(v,'d1'); await W(250);
  ok('click again unfolds it',await vis('d11'));
  { const bx=await v.locator('#mapsvg g.node[data-id="d2"] .cc circle, #mapsvg g.node[data-id="d2"] .cc').first().boundingBox(); await v.mouse.click(bx.x+bx.width/2,bx.y+bx.height/2); } await W(250);
  ok('badge of a folded branch unfolds it',await vis('d21'));
  await clickAt(v,'d12'); await W(250);
  ok('node with a note opens a read-only sheet',/先修手機版/.test(await v.locator('.vwsheet').textContent().catch(()=>'')));
  await v.keyboard.press('Escape'); await clickAt(v,'d3',2); await v.keyboard.press('Delete'); await v.keyboard.press('Tab'); await W(200);
  ok('double-click / Delete / Tab change nothing',await vis('d3')&&await v.evaluate(()=>!document.querySelector('input,textarea')));
  const z0=await v.locator('#pct').textContent(); await v.click('[data-a="in"]'); const z1=await v.locator('#pct').textContent(); await v.click('[data-a="fit"]');
  ok('zoom buttons work',z0!==z1);
  await v.click('[data-a="level"][data-v="1"]'); await W(200); ok('層級 1 folds everything below level 1',!(await vis('d11'))&&await vis('d1'));
  await v.click('[data-a="level"][data-v="0"]'); await W(200); ok('全部 unfolds everything',await vis('d11')&&await vis('d21'));
  if(SHOTS){ await v.click('[data-a="fit"]'); await W(200); await v.screenshot({path:`${SHOTS}/viewer-desktop-coral.png`}); }
  ok('viewer sent no cookies and used no API key',!drive.requests.some(r=>/key=/.test(r)));
  // edit → stale → update keeps the link
  await clickAt(p,'d3'); await p.keyboard.press('Tab'); await W(300); await p.keyboard.type('面試流程'); await p.keyboard.press('Enter'); await W(400);
  await btn.click(); await p.waitForSelector('.shmodal');
  ok('after an edit the dialog warns the link shows the old version',await p.locator('.shsnap.stale').isVisible()&&/舊版本/.test(await p.locator('.shsnap').textContent()));
  const fid0=drive.shares()[0].id; await p.click('[data-act="shareUpdate"]'); await p.waitForFunction(()=>!document.querySelector('.shsnap.stale')&&!document.querySelector('.shmodal [disabled]'),null,{timeout:10000});
  ok('更新連結內容 keeps the same Sheet and link',drive.shares().length===1&&drive.shares()[0].id===fid0&&await p.inputValue('#sh-url')===link1);
  await v.reload(); await v.waitForFunction(()=>document.body.dataset.ready==='1');
  ok('recipient sees the update on reload',await v.evaluate(()=>!![...document.querySelectorAll('#mapsvg g.node')].find(g=>g.textContent.includes('面試流程'))));
  // another device: no local share state, the link is found again on Drive
  await p.click('.shmodal [data-act="closeDialog"]'); await p.evaluate(()=>{ window.__mmStore.maps.setMeta('mdef',{share:null}); });
  await btn.click(); await p.waitForSelector('#sh-url',{timeout:5000}).catch(()=>{});
  ok('share state is recovered from Drive (other device)',await p.locator('#sh-url').count()&&await p.inputValue('#sh-url')===link1);
  // stop
  await p.click('.shmodal .mfoot [data-act="shareStop"]'); await W(150);
  ok('停止分享 asks to confirm and explains the link dies',/連結會立刻失效/.test(await p.locator('.shstop').textContent()));
  if(SHOTS) await p.screenshot({path:`${SHOTS}/share-desktop-stop.png`});
  await p.click('.shstop [data-act="shareStop"][data-v="yes"]'); await p.waitForSelector('[data-act="shareCreate"]',{timeout:10000});
  ok('stop deletes the Sheet',drive.shares().length===0); ok('toast confirms stop',/已停止分享/.test(await p.locator('#toast').textContent()));
  await v.reload(); await v.waitForFunction(()=>document.body.dataset.ready);
  ok('stopped link shows 這個分享已停止或不存在',/已停止或不存在/.test(await v.locator('.vwmsg h2').textContent()));
  if(SHOTS) await v.screenshot({path:`${SHOTS}/viewer-desktop-stopped.png`});
  await R.ctx.close();
  // inline link (no Google)
  await p.click('[data-act="shareInline"]'); await p.waitForSelector('#sh-url'); const inl=await p.inputValue('#sh-url');
  ok('inline link warns it cannot be stopped',/無法停止分享/.test(await p.locator('.shmodal').textContent())&&/view\.html#z=/.test(inl));
  const before=drive.requests.length; const R2=await recipient(inl);
  ok('inline link opens signed-out without any network read',await R2.p.evaluate(()=>document.body.dataset.ready)==='1'&&(await R2.p.locator('#vwt').textContent())==='季度規劃'&&!drive.requests.slice(before).some(r=>/SHEET/.test(r)));
  await R2.ctx.close();
  await p.click('[data-act="shareInlineBack"]'); await p.click('[data-act="shareCreate"]'); await p.waitForSelector('#sh-url');
  // the Sheet deleted in Drive by hand: opening the dialog (signed in) shows it is no longer shared
  const gone=drive.shares()[0].id; drive.files.delete(gone); await p.click('.shmodal [data-act="closeDialog"]'); await btn.click(); await p.waitForSelector('[data-act="shareCreate"]',{timeout:5000}).catch(()=>{});
  ok('Sheet deleted in Drive: dialog shows not shared',await p.locator('[data-act="shareCreate"]').count()===1&&!(await p.evaluate(()=>window.__mmStore.maps.meta('mdef').share)));
  // the Sheet can't be rewritten: update makes a new link, removes the old Sheet and says so
  await p.click('[data-act="shareCreate"]'); await p.waitForSelector('#sh-url'); const l2=await p.inputValue('#sh-url'); const old=drive.shares()[0].id; await W(300);
  drive.failNext({status:404,message:'File not found'}); await p.click('[data-act="shareUpdate"]'); await p.waitForFunction(l=>{ const i=document.querySelector('#sh-url'); return i&&i.value!==l; },l2,{timeout:10000});
  ok('update fails: new link, old Sheet removed, user told',drive.shares().length===1&&drive.shares()[0].id!==old&&/連結已換新/.test(await p.locator('#toast').textContent()));
  await p.click('.shmodal .mfoot [data-act="shareStop"]'); await p.click('.shstop [data-act="shareStop"][data-v="yes"]'); await p.waitForSelector('[data-act="shareCreate"]');
  // a Google popup closed by the user is not an error message
  await p.evaluate(()=>{ window.__gis.mode='closed'; }); await p.evaluate(()=>window.__mmStore&&0);
  await ctx.close(); }

// ---------- 3. phone: 更多 → 分享唯讀連結… ----------
{ const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}); await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(BASE).origin}); await routes(ctx,drive); await seed(ctx);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('app-m: '+e.message)); await p.goto(BASE+'#/map/mcls'); await p.waitForSelector('#mapsvg g.node');
  const tapSel=async s=>{ const bx=await p.locator(s).first().boundingBox(); await p.touchscreen.tap(bx.x+bx.width/2,bx.y+bx.height/2); await W(350); };
  ok('phone toolbar has no desktop 分享 button (lives in 更多)',!(await p.locator('.top [data-act="share"]').isVisible()));
  await tapSel('.top .rb.more'); const item=p.locator('.ctx [data-act="share"]'); ok('更多 menu has 分享唯讀連結…',await item.isVisible()&&/分享唯讀連結/.test(await item.textContent()));
  if(SHOTS) await p.screenshot({path:`${SHOTS}/share-mobile-more.png`});
  await tapSel('.ctx [data-act="share"]'); await p.waitForSelector('.shmodal'); await W(300);
  const tooSmall=await p.evaluate(()=>[...document.querySelectorAll('.shmodal button,.shmodal a')].filter(e=>e.offsetParent).map(e=>{ const r=e.getBoundingClientRect(); return [e.textContent.trim().slice(0,12)||e.getAttribute('aria-label'),Math.round(r.width),Math.round(r.height)]; }).filter(x=>x[2]<44&&!/複製/.test(x[0])));
  ok('dialog buttons are ≥44px tall on the phone',tooSmall.length===0,JSON.stringify(tooSmall));
  ok('dialog fits the 390px screen',await p.evaluate(()=>{ const r=document.querySelector('.shmodal').getBoundingClientRect(); return r.left>=0&&r.right<=390; }));
  if(SHOTS) await p.screenshot({path:`${SHOTS}/share-mobile-dialog.png`});
  await tapSel('[data-act="shareCreate"]'); await p.waitForSelector('#sh-url',{timeout:10000}); await W(200); const link=await p.inputValue('#sh-url');
  ok('phone: link created and copied',/view\.html#s=/.test(link)&&await p.evaluate(()=>navigator.clipboard.readText())===link);
  if(SHOTS) await p.screenshot({path:`${SHOTS}/share-mobile-shared.png`});
  await tapSel('.shmodal [data-act="closeDialog"]'); await tapSel('.top .rb.more');
  ok('更多 shows 分享中 afterwards',/分享中/.test(await p.locator('.ctx [data-act="share"]').textContent())); await p.keyboard.press('Escape');
  // the recipient on a phone, classic map with its own background, picture and sticker
  const R=await recipient(link,{mobile:true}); const v=R.p;
  ok('phone viewer opens the classic map with its own background',(await v.locator('#vwt').textContent())==='旅行計畫'&&await v.evaluate(()=>getComputedStyle(document.querySelector('#cv')).getPropertyValue('--cv').trim().toLowerCase()==='#f5f9fc'));
  ok('picture and sticker are embedded',await v.evaluate(()=>document.querySelectorAll('#mapsvg image').length>=2&&[...document.querySelectorAll('#mapsvg image')].every(i=>/^data:/.test(i.getAttribute('href')))));
  ok('nothing overflows the phone width',await v.evaluate(()=>document.documentElement.scrollWidth<=390));
  if(SHOTS) await v.screenshot({path:`${SHOTS}/viewer-mobile-classic.png`});
  const vis=async id=>v.evaluate(id=>!!document.querySelector(`#mapsvg g.node[data-id="${id}"]`),id);
  const tapNode=async id=>{ const bx=await v.locator(`#mapsvg g.node[data-id="${id}"] rect.hit`).boundingBox(); await v.touchscreen.tap(bx.x+bx.width/2,bx.y+bx.height/2); await W(350); };
  await tapNode('c1'); ok('tap folds a branch on the phone',!(await vis('c11'))); await tapNode('c1'); ok('tap unfolds it',await vis('c11'));
  const cc=await v.locator('#mapsvg g.node[data-id="c2"] .cc').first().boundingBox(); await v.touchscreen.tap(cc.x+cc.width/2,cc.y+cc.height/2); await W(350); ok('tap the badge unfolds a folded branch',await vis('c21'));
  // pinch zoom
  const cdp=await R.ctx.newCDPSession(v); const t=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y],i)=>({x,y,id:i}))});
  const s0=await v.evaluate(()=>window.__mmv.vp.sc); await t('touchStart',[[150,500],[240,500]]); for(let i=1;i<=8;i++){ await t('touchMove',[[150-i*8,500],[240+i*8,500]]); await W(20); } await t('touchEnd',[]); await W(300);
  ok('pinch zooms',await v.evaluate(()=>window.__mmv.vp.sc)>s0*1.2);
  await v.click('[data-a="fit"]').catch(()=>{}); await W(200); if(SHOTS) await v.screenshot({path:`${SHOTS}/viewer-mobile-classic-fit.png`});
  await R.ctx.close();
  // the coral map on a phone, for the screenshot set
  if(SHOTS){ await p.goto(BASE+'#/map/mdef'); await p.waitForSelector('#mapsvg g.node'); await tapSel('.top .rb.more'); await tapSel('.ctx [data-act="share"]'); await p.waitForSelector('[data-act="shareCreate"]'); await tapSel('[data-act="shareCreate"]'); await p.waitForSelector('#sh-url');
    const R3=await recipient(await p.inputValue('#sh-url'),{mobile:true}); await R3.p.screenshot({path:`${SHOTS}/viewer-mobile-coral.png`}); await R3.ctx.close(); }
  await ctx.close(); }

// ---------- 4. service worker: an installed app opens share links in the viewer, not the editor ----------
{ const ctx=await b.newContext(); await routes(ctx,drive); await seed(ctx); const p=await ctx.newPage(); await p.goto(BASE); await p.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:15000}).catch(()=>{});
  const ctl=await p.evaluate(()=>!!navigator.serviceWorker.controller);
  await p.goto(BASE+'view.html#z=bad'); await p.waitForFunction(()=>document.body.dataset.ready,null,{timeout:10000}).catch(()=>{});
  ok('with the service worker active, view.html is the viewer',ctl&&await p.evaluate(()=>document.body.classList.contains('vw')));
  await ctx.close(); }
ok('no page errors',errs.length===0,errs.join(' | '));
await b.close();
const pass=res.filter(r=>r[1]).length; console.log(`${pass}/${res.length} passed`); process.exit(pass===res.length?0:1);
