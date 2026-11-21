// Google Drive sync, end to end against an in-memory Drive and a stubbed Google sign-in (real Google login can't be automated).
// Run: BASE=http://localhost:8765/ node tests/drive.mjs   (SHOTS=dir also saves 10-drive-* screenshots)
import { chromium } from 'playwright-core';
import { mockDrive, GIS_STUB } from './drive-mock.mjs';
import { mockGH } from './mock.mjs';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push(!!c);console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({executablePath:exe});
const N=(id,t,c)=>({id,t,...(c?{c}:{})});
const docOf=(id,title,kids)=>({format:'mymind/1',id,theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:N(id+'r',title,kids)});
const A=docOf('mapA','名古屋三天兩夜',[N('a1','行程'),N('a2','美食'),N('a3','交通')]), B=docOf('mapB','產品規劃',[N('b1','目標'),N('b2','時程')]);
async function setup({mobile=false,docs=[A,B],prefs={mode:'local',sync:'local'},pat='',drive=mockDrive(),gh=null}={}){
  const ctx=await b.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1440,height:900}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:GIS_STUB}));
  await ctx.route('https://www.googleapis.com/**',drive.handler);
  if(gh) await ctx.route('https://api.github.com/**',gh.handler);
  await ctx.addInitScript(({docs,prefs,pat})=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.clear(); localStorage.setItem('mymind.prefs',JSON.stringify(prefs)); if(pat) localStorage.setItem('mymind.pat',JSON.stringify(pat));
    localStorage.setItem('mymind.index',JSON.stringify(docs.map(d=>({id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created,...(d._meta||{})})))); docs.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{docs,prefs,pat});
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/status of (401|404|409|422|429|500)/.test(m.text())) p.errs.push(m.text()); });
  await p.goto(BASE+'?nosw'); await p.waitForSelector('body[data-ready="1"]'); await W(300); p.ctx=ctx; p.drive=drive; return p; }
const click=(p,sel)=>p.evaluate(s=>{ const l=[...document.querySelectorAll(s)]; const e=l.find(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed')||l[0]; if(!e) throw new Error('no '+s); e.click(); },sel);
const settle=async p=>{ await W(250); await p.waitForFunction(()=>window.__mm.sync.state!=='saving',null,{timeout:15000}).catch(()=>{}); await W(250); };
const state=p=>p.evaluate(()=>({st:window.__mm.sync.state,msg:window.__mm.sync.msg,un:window.__mm.unsynced,auth:window.__mm.driveAuth}));
const shot=async(p,name)=>{ if(SHOTS) await p.screenshot({path:`${SHOTS}/${name}.png`}); };
const edit=(p,id,fn)=>p.evaluate(([id,fn])=>{ const S=window.__mm; const st=window.__mmStore; const d=st.maps.load(id); (new Function('d',fn))(d); d.updated=new Date().toISOString(); st.maps.save(id,d); st.maps.setMeta(id,{dirty:true,updated:d.updated,title:d.root.t}); if(S.mapId===id) S.doc=d; st.changed(); },[id,fn]);
const noSecrets=p=>p.evaluate(()=>{ const all=Object.keys(localStorage).map(k=>localStorage.getItem(k)).join('\n'); return !/tok\d+/.test(all)&&!/access_token/.test(all); });

for(const mobile of [false,true]){ const T=mobile?'[mobile] ':'';
// ---------- 1. connect flow (local user with 2 maps) ----------
{ const p=await setup({mobile}); const D=p.drive;
  await click(p,'[data-act="settings"]'); await W(300);
  ok(T+'settings: 「同步到哪裡」 offers Google 雲端硬碟 and GitHub',await p.locator('.bkopts [data-act="formBackend"]').count()===2);
  ok(T+'no Google script before the user asks',await p.evaluate(()=>!document.querySelector('script[src*="accounts.google.com"]')));
  await shot(p,`10-drive-settings-${mobile?'mobile':'desktop'}`);
  await click(p,'[data-act="driveConnect"]'); await W(600);
  const g=await p.evaluate(()=>window.__gis);
  ok(T+'connect: token client asked for drive.file only, with the MyMind client id',g&&g.log[0].scope==='https://www.googleapis.com/auth/drive.file'&&g.log[0].client.startsWith('269576596638-'),JSON.stringify(g&&g.log));
  ok(T+'connect: account email shown, MyMind folder created',(await p.locator('.gdcard.ok').textContent()).includes('hanzhang.test@gmail.com')&&!!D.folder());
  await shot(p,`10-drive-connected-${mobile?'mobile':'desktop'}`);
  ok(T+'connect: mode switched to 手動同步 by default',await p.locator('[data-act="formSync"][data-v="manual"][aria-checked="true"]').count()===1);
  await click(p,'[data-act="saveSettings"]'); await settle(p);
  let s=await state(p); ok(T+'after save: maps wait for 同步 (manual)',s.un===2&&!D.mapFile('mapA'),JSON.stringify(s));
  await click(p,mobile?'.rb [data-act="syncNow"],[data-act="syncNow"]':'[data-act="syncNow"]'); await settle(p);
  ok(T+'push: one .mymind file per map inside MyMind, plus index.json',D.doc('mapA')?.root.t==='名古屋三天兩夜'&&D.doc('mapB')?.root.t==='產品規劃'&&D.index()?.maps.length===2,JSON.stringify(D.inFolder().map(f=>f.name)));
  s=await state(p); ok(T+'push: all synced',s.un===0&&s.st==='saved',JSON.stringify(s));
  if(!mobile) ok(T+'sidebar shows Google 雲端硬碟 · email',(await p.locator('.side-foot .sync').textContent()).includes('Google 雲端硬碟 · hanzhang.test@gmail.com'));
  ok(T+'token never written to storage',await noSecrets(p));
  // ---------- 2. pull ----------
  D.serverEdit('mapB',d=>{ d.root.t='產品規劃（另一台改）'; });
  await p.evaluate(()=>window.__mmStore.syncNow({push:false,reason:'auto'})); await settle(p);
  ok(T+'pull: change made on another device arrives',await p.evaluate(()=>window.__mmStore.maps.load('mapB').root.t)==='產品規劃（另一台改）');
  D.serverPut(docOf('mapC','新裝置建立的圖',[N('c1','點子')]));
  D.serverEdit('mapA',d=>{ d.root.c.push({id:'a9',t:'外部新增'}); });
  await p.evaluate(()=>{ window.__mm.lastOpenPull=0; location.hash='#/map/mapA'; }); await W(400); await settle(p);
  ok(T+'pull on open: opening a map fetches its newer version',await p.evaluate(()=>JSON.stringify(window.__mm.doc.root).includes('外部新增')));
  ok(T+'pull: map created elsewhere appears',await p.evaluate(()=>!!window.__mmStore.maps.load('mapC')));
  // ---------- 3. conflict ----------
  D.serverEdit('mapA',d=>{ d.root.c[0].t='行程（雲端）'; });
  await edit(p,'mapA',"d.root.c[1].t='美食（本機）'");
  await click(p,'[data-act="syncNow"]'); await settle(p); await W(300);
  ok(T+'conflict: changed on both sides → conflict dialog (Drive version check)',await p.locator('.dlg,.modal').filter({hasText:'雲端'}).count()>=1&&(await state(p)).st==='error');
  await shot(p,`10-drive-conflict-${mobile?'mobile':'desktop'}`);
  { const g=await p.evaluate(()=>{ const r=[...document.querySelectorAll('.dlg .radio')].at(-1), f=document.querySelector('.dlg .mfoot'), sp=r&&r.querySelector('span:last-child, small, p'); const rb=r.getBoundingClientRect(), fb=f.getBoundingClientRect(); return {last:rb.bottom,foot:fb.top,txt:r.textContent}; });
    ok(T+'conflict: 3rd choice and its 副本 explanation fully visible above the footer (review r2 MUST)',g.last<=g.foot+0.5&&/副本/.test(g.txt),JSON.stringify(g)); }
  await click(p,'[data-act="cfPick"][data-v="merge"]'); await click(p,'[data-act="cfApply"]'); await settle(p);
  const ad=D.doc('mapA'); ok(T+'conflict: merge keeps both edits and uploads',ad&&JSON.stringify(ad).includes('行程（雲端）')&&JSON.stringify(ad).includes('美食（本機）'),JSON.stringify(ad&&ad.root.c));
  // ---------- 4. auto mode batching ----------
  await p.evaluate(()=>{ const k='mymind.prefs'; const v=JSON.parse(localStorage.getItem(k)); v.sync='auto'; v.autoMs=1500; localStorage.setItem(k,JSON.stringify(v)); });
  await p.evaluate(()=>{ location.hash='#/map/mapB'; }); await W(400); await settle(p);
  const up0=D.count(/^PATCH \/upload\/drive\/v3\/files\/.+/), li0=D.count(/in%20parents|in\+parents|%27%20in%20parents/);
  for(const t of ['一','二','三']){ await p.focus('#cv'); await p.keyboard.press('Tab'); await p.keyboard.type('自動'+t); await p.keyboard.press('Enter'); await p.keyboard.press('Escape'); await W(120); }
  await edit(p,'mapC',"d.root.t='新裝置建立的圖（改）'");
  await W(400); ok(T+'auto: nothing uploaded before the batch window',D.count(/^PATCH \/upload\/drive\/v3\/files\/.+/)===up0);
  await W(2200); await settle(p);
  const up1=D.count(/^PATCH \/upload\/drive\/v3\/files\/.+/)-up0, li1=D.count(/in%20parents|in\+parents|%27%20in%20parents/)-li0;
  ok(T+'auto: several edits on 2 maps → ONE sync run, 2 map uploads (+ index)',up1===3&&li1===1,`uploads ${up1}, list calls ${li1}`);
  ok(T+'auto: edits arrived',JSON.stringify(D.doc('mapB')).includes('自動三')&&D.doc('mapC').root.t.endsWith('（改）'),JSON.stringify(D.doc('mapB').root)+' / '+D.doc('mapC').root.t);
  // ---------- 5. offline queue ----------
  await p.ctx.setOffline(true); await W(100);
  await edit(p,'mapB',"d.root.t='離線時修改'"); await W(2200);
  s=await state(p); ok(T+'offline: change kept locally and queued',s.st==='offline'&&s.un>=1,JSON.stringify(s));
  if(mobile) await shot(p,'10-drive-offline-mobile');
  await p.ctx.setOffline(false); await W(300); await settle(p); await W(600); await settle(p);
  ok(T+'back online: queue is uploaded',D.doc('mapB').root.t==='離線時修改'&&(await state(p)).un===0,JSON.stringify(await state(p)));
  // ---------- 6. token expiry → reconnect ----------
  D.expireAll(); const calls0=await p.evaluate(()=>window.__gis.calls);
  await edit(p,'mapA',"d.root.t='過期後修改'"); await W(2200); await settle(p);
  s=await state(p); ok(T+'expired token: shows 「重新連結」, edits stay local',s.auth&&s.un>=1&&await p.locator('.syncbtn.reauth').count()>=1,JSON.stringify(s));
  if(mobile){ ok(T+'phone: reconnect shown as text strip + ! badge on ⋯ (not icon only)',await p.locator('.mstat.warn').isVisible()&&/重新連結 Google/.test(await p.locator('.mstat.warn').textContent())&&await p.locator('.rb.more .nbadge.warn').isVisible());
    const tw=await p.evaluate(()=>{ const b=document.querySelector('.backpill'); return b?b.getBoundingClientRect().width:0; }); ok(T+'phone: title pill keeps a readable width (≥ 112px)',tw>=112,String(tw)); }
  await shot(p,`10-drive-reconnect-${mobile?'mobile':'desktop'}`);
  await click(p,mobile?'.mstat.warn':'.syncbtn.reauth'); await W(500); await settle(p);
  const lg=await p.evaluate(()=>window.__gis.log.at(-1));
  ok(T+'reconnect: one click, no consent prompt, account hinted',(await p.evaluate(()=>window.__gis.calls))===calls0+1&&lg.prompt===''&&lg.hint==='hanzhang.test@gmail.com',JSON.stringify(lg));
  ok(T+'reconnect: queued edit uploaded',D.doc('mapA').root.t==='過期後修改');
  // ---------- 7. reload: token was memory-only ----------
  await p.reload(); await p.waitForSelector('body[data-ready="1"]'); await W(500);
  s=await state(p); ok(T+'after reload: needs a click to reconnect (token was in memory only)',s.auth===true,JSON.stringify(s));
  ok(T+'no Google network calls without a token',await p.evaluate(()=>!document.querySelector('script[src*="accounts.google.com"]')));
  // ---------- 8. history from Drive revisions ----------
  { await click(p,'[data-act="syncNow"]'); await settle(p); await p.evaluate(()=>{ location.hash='#/map/mapA'; }); await W(400); await click(p,'[data-act="history"]'); await W(900);
    const ht=await p.locator('.hist').textContent().catch(()=>'');
    ok(T+'history panel lists Drive revisions with version number + clock time',await p.locator('.hist li').count()>=2&&/第 \d+ 版/.test(ht)&&/\d+\/\d+ \d\d:\d\d/.test(ht),ht.slice(0,120)); await shot(p,`10-drive-history-${mobile?'mobile':'desktop'}`); await click(p,'[data-act="closePanel"]'); await W(200); }
  // ---------- 9. disconnect ----------
  await click(p,'[data-act="settings"]'); await W(300); await click(p,'[data-act="driveDisconnect"]'); await W(300);
  ok(T+'disconnect asks first (nothing revoked yet)',/再授權/.test(await p.locator('.gdconfirm').textContent())&&await p.evaluate(()=>!!JSON.parse(localStorage.getItem('mymind.prefs')).driveEmail));
  await shot(p,`10-drive-disconnect-confirm-${mobile?'mobile':'desktop'}`);
  await click(p,'[data-act="driveDisconnect"][data-v="yes"]'); await W(300);
  ok(T+'disconnect: '+(mobile?'':'token revoked, ')+'back to 只存瀏覽器, maps still here',(mobile||await p.evaluate(()=>!!(window.__gis&&window.__gis.revoked)))&&await p.evaluate(()=>JSON.parse(localStorage.getItem('mymind.prefs')).sync)==='local'&&await p.evaluate(()=>window.__mmStore.maps.index().length)===3);
  ok(T+'no page errors (incl. CSP)',!p.errs.length,p.errs.join(' | '));
  await p.ctx.close(); }
}
// ---------- 10. sign-in problems ----------
{ const p=await setup(); await click(p,'[data-act="settings"]'); await W(300);
  await p.evaluate(()=>{ window.__gis={calls:0,mode:'closed',log:[]}; }); await click(p,'[data-act="driveConnect"]'); await W(600);
  ok('popup closed: friendly error, nothing saved',(await p.locator('.setsec .alert.err').textContent()).includes('Google 登入視窗已關閉')&&!(await p.evaluate(()=>JSON.parse(localStorage.getItem('mymind.prefs')).driveEmail)));
  await p.evaluate(()=>{ window.__gis.mode='noscope'; }); await click(p,'[data-act="driveConnect"]'); await W(600);
  ok('Drive permission unticked on the consent screen: explained',(await p.locator('.setsec .alert.err').textContent()).includes('沒有勾選'));
  await click(p,'[data-act="formSync"][data-v="manual"]'); await click(p,'[data-act="saveSettings"]'); await W(200);
  ok('saving Drive sync without connecting is refused',(await p.locator('.setsec .alert.err').textContent()).includes('請先按「連結 Google 雲端硬碟」'));
  await p.ctx.close(); }
// ---------- 11. switch GitHub → Drive (migration) ----------
{ const gh=mockGH(); gh.serverPut('maps/mapG.json',docOf('mapG','只在 GitHub 的圖',[N('g1','x')]));
  const a={...A,_meta:{dirty:false,remote:true,sha:null}}; const p=await setup({prefs:{mode:'github',sync:'manual',repo:'hctsaik/mymind-data'},pat:'github_pat_TESTONLY',gh,docs:[A]});
  await click(p,'[data-act="syncNow"]'); await settle(p); const ghCommits=gh.commits.length;
  await click(p,'[data-act="settings"]'); await W(300); await click(p,'[data-act="formBackend"][data-v="drive"]'); await W(150); await click(p,'[data-act="driveConnect"]'); await W(600);
  await click(p,'[data-act="saveSettings"]'); await settle(p); await click(p,'[data-act="syncNow"]'); await settle(p);
  const D=p.drive; ok('switch GitHub → Drive: every map (incl. ones only on GitHub) uploaded to Drive',!!D.doc('mapA')&&!!D.doc('mapG'),JSON.stringify(D.inFolder().map(f=>f.name)));
  ok('switch: GitHub left untouched (no new commits)',gh.commits.length===ghCommits);
  ok('switch: GitHub key still in this browser for switching back',await p.evaluate(()=>!!localStorage.getItem('mymind.pat')));
  ok('no page errors',!p.errs.length,p.errs.join(' | ')); await p.ctx.close(); }
await b.close(); console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean)?0:1);
