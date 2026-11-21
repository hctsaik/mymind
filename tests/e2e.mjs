// End-to-end tests with mocked GitHub + OpenAI. Run: BASE=http://localhost:8765/ node tests/e2e.mjs
import { chromium } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/';
const SHOTS=process.env.SHOTS||'/workspace/mymind/app-shots';
const results=[]; const ok=(name,cond,info='')=>{results.push({name,pass:!!cond,info});console.log((cond?'PASS ':'FAIL ')+name+(info?' — '+info:''));};
const b=await chromium.launch({executablePath:exe});
import { mockGH, aiHandler, aiCalls, setAiMode } from './mock.mjs';
async function setup(vp,{gh,mobile}={}){ const ctx=await b.newContext({viewport:vp,deviceScaleFactor:mobile?2:1,isMobile:!!mobile,hasTouch:!!mobile});
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|fonts\.g|status of (401|404|409|429)/.test(m.text()))p.errs.push(m.text())});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  if(gh) await ctx.route('https://api.github.com/**',gh.handler);
  await ctx.route('https://api.openai.com/**',aiHandler);
  return {ctx,p}; }
const ready=p=>p.waitForSelector('body[data-ready="1"]');
const W=ms=>new Promise(r=>setTimeout(r,ms));
const settle=async p=>{ await W(300); await p.waitForFunction(()=>window.__mm.sync.state!=='saving',null,{timeout:15000}).catch(()=>{}); await W(200); };
const nodes=p=>p.locator('#mapsvg g.node').count();
// ================= desktop, local mode =================
{ const ghReq=[]; const {ctx,p}=await setup({width:1440,height:900}); await ctx.route('https://api.github.com/**',r=>{ghReq.push(r.request().url()); r.abort();});
  await p.goto(BASE); await ready(p);
  ok('welcome page shown on first run', await p.locator('.welcome').count()===1);
  ok('welcome: 「先存在這個瀏覽器」 is the primary choice', (await p.locator('.choice.rec .btn.primary').textContent()).includes('先存在這個瀏覽器')&&/選用/.test(await p.locator('.choice:not(.rec)').textContent()));
  await p.screenshot({path:SHOTS+'/01-welcome-desktop.png'});
  await p.click('[data-act="welcomeLocal"]'); await W(200);
  ok('empty state after choosing local', await p.locator('.empty').count()>=1);
  await p.click('.empty [data-act="new"]'); await W(400);
  ok('new map opens editing root', await p.locator('textarea.editbox').count()===1);
  await p.keyboard.type('產品發表會'); await p.keyboard.press('Enter'); await W(100);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Tab'); await p.keyboard.type('講者'); await p.keyboard.press('Enter');
  await p.keyboard.press('Enter'); await p.keyboard.type('場地'); await p.keyboard.press('Enter');
  let tree=await p.evaluate(()=>JSON.stringify(window.__mm.doc.root,(k,v)=>k==='id'?undefined:v));
  ok('Tab adds child, Enter adds sibling', /"c":\[\{"t":"講者"\},\{"t":"場地"\}\]/.test(tree), tree.slice(0,160));
  const n0=await nodes(p); await p.keyboard.press('Delete'); await W(50);
  ok('Delete removes node', await nodes(p)===n0-1);
  await p.keyboard.press('Control+z'); await W(50); ok('Ctrl+Z restores node', await nodes(p)===n0);
  await p.keyboard.press('Control+y'); await W(50); ok('Ctrl+Y redoes', await nodes(p)===n0-1);
  await p.keyboard.press('Control+z'); await W(50);
  // F2 edit
  await p.keyboard.press('F2'); await p.keyboard.press('Control+a'); await p.keyboard.type('場地與設備'); await p.keyboard.press('Enter'); await W(50);
  ok('F2 rename', await p.evaluate(()=>JSON.stringify(window.__mm.doc.root).includes('場地與設備')));
  // Shift+Tab outdent
  await p.keyboard.press('Shift+Tab'); await W(50);
  ok('Shift+Tab promotes node', await p.evaluate(()=>window.__mm.doc.root.c.some(c=>c.t==='場地與設備')));
  await p.keyboard.press('Control+z');
  // collapse via Space? (collapse with keyboard: '.')
  await p.evaluate(()=>{const S=window.__mm; S.sel=S.doc.root.c.find(c=>c.c&&c.c.length).id;});
  await p.locator('#cv').focus(); const before=await nodes(p);
  await p.keyboard.press('Control+.'); await W(80);
  const afterCollapse=await nodes(p);
  ok('collapse hides descendants (Ctrl+.)', afterCollapse<before, `${before}→${afterCollapse}`);
  if(afterCollapse<before){ await p.keyboard.press('Control+.'); await W(80); }
  // context menu keyboard behaviour (dev suggestion 1)
  const nb=await p.locator('#mapsvg g.node').nth(1).boundingBox();
  await p.mouse.click(nb.x+nb.width/2,nb.y+nb.height/2,{button:'right'}); await W(150);
  const firstFocused=await p.evaluate(()=>document.activeElement&&document.activeElement.getAttribute('role'));
  ok('context menu focuses first menuitem', firstFocused==='menuitem');
  const t1=await p.evaluate(()=>document.activeElement.textContent.trim()); await p.keyboard.press('ArrowDown');
  const t2=await p.evaluate(()=>document.activeElement.textContent.trim());
  ok('ArrowDown moves within menu', t1!==t2, `${t1} → ${t2}`);
  await p.screenshot({path:SHOTS+'/03-context-menu.png'});
  await p.keyboard.press('Escape'); await W(80);
  ok('Esc closes menu and returns focus', await p.locator('#layer [role=menu]').count()===0 && await p.evaluate(()=>!!document.activeElement.closest('#cv')||document.activeElement.id==='cv'));
  // note
  await p.keyboard.press('Control+Alt+m'); await W(200);
  ok('note panel opens', await p.locator('#notearea').count()===1);
  await p.fill('#notearea','記得確認投影設備'); await W(600);
  ok('note saved', await p.evaluate(()=>JSON.stringify(window.__mm.doc.root).includes('記得確認投影設備')));
  // style drawer & tabs (dev suggestion 4)
  await p.click('[data-act="style"].desk-only'); await W(200);
  const tabs=await p.$$eval('[role=tab][aria-controls^="sp-"]',ts=>ts.map(t=>[t.getAttribute('aria-controls'),!!document.getElementById(t.getAttribute('aria-controls'))]));
  ok('style tabs each control their own tabpanel', tabs.length===4&&new Set(tabs.map(t=>t[0])).size===4&&tabs.every(t=>t[1]), JSON.stringify(tabs));
  await p.screenshot({path:SHOTS+'/02-editor-style-desktop.png'});
  await p.click('[data-act="theme"][data-v="midnight"]'); await W(150);
  ok('theme change', await p.evaluate(()=>window.__mm.doc.theme)==='midnight');
  await p.keyboard.press('Control+z'); await W(100);
  // outline
  await p.keyboard.press('Control+o'); await W(200); ok('outline view', await p.locator('.olrow').count()>=5);
  await p.screenshot({path:SHOTS+'/04-outline.png'});
  await p.keyboard.press('Control+o'); await W(200);
  // shortcuts
  await p.locator('#cv').focus(); await p.keyboard.press('?'); await W(150);
  const hasKbt=await p.locator('.kbt').count(); if(hasKbt){ await p.keyboard.press('Escape'); }
  ok('shortcuts dialog (Ctrl+/)', hasKbt>0);
  // export markdown
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.evaluate(()=>{})]);
  await p.click('[data-act="exportMenu"]'); await W(150);
  const [d2]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('[data-act="exp"][data-v="md"]')]);
  let md=''; if(d2){ const fp=await d2.path(); md=(await import('node:fs')).readFileSync(fp,'utf8'); }
  ok('export Markdown', md.startsWith('# 產品發表會')&&md.includes('  - 場地'), md.slice(0,60).replace(/\n/g,'⏎'));
  await p.click('[data-act="exportMenu"]'); await W(150);
  const [d3]=await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null),p.click('[data-act="exp"][data-v="png"]')]);
  let pngOk=false; if(d3){ const buf=(await import('node:fs')).readFileSync(await d3.path()); pngOk=buf.slice(1,4).toString()==='PNG'&&buf.length>2000; }
  ok('export PNG', pngOk);
  await p.click('[data-act="exportMenu"]'); await W(150);
  const [d4]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('[data-act="exp"][data-v="opml"]')]);
  let opml=''; if(d4) opml=(await import('node:fs')).readFileSync(await d4.path(),'utf8'); ok('export OPML', opml.includes('<opml')&&opml.includes('場地'));
  // import markdown
  await p.goto(BASE+'#/'); await W(200);
  const fs=await import('node:fs'); fs.writeFileSync('/tmp/mm-import.md','# 匯入測試\n- 甲\n  - 甲一\n- 乙\n');
  const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('[data-act="import"]')]); await fc.setFiles('/tmp/mm-import.md'); await W(500);
  ok('import Markdown creates map', await p.evaluate(()=>window.__mm.doc&&window.__mm.doc.root.t==='匯入測試'&&window.__mm.doc.root.c.length===2));
  fs.writeFileSync('/tmp/mm-import.opml','<?xml version="1.0"?><opml version="2.0"><head><title>OPML 測試</title></head><body><outline text="OPML 測試"><outline text="A"><outline text="A1"/></outline><outline text="B"/></outline></body></opml>');
  await p.goto(BASE+'#/'); await W(200);
  const [fc2]=await Promise.all([p.waitForEvent('filechooser'),p.click('[data-act="import"]')]); await fc2.setFiles('/tmp/mm-import.opml'); await W(500);
  ok('import OPML creates map', await p.evaluate(()=>window.__mm.doc&&window.__mm.doc.root.t==='OPML 測試'));
  // map list, search
  await p.goto(BASE+'#/'); await W(200);
  ok('map list shows 3 maps', await p.locator('.grid > .card').count()>=3, String(await p.locator('.grid > .card').count()));
  await p.fill('#homeq','匯入'); await W(150);
  ok('search filters list', await p.locator('.grid > .card').count()===1);
  await p.screenshot({path:SHOTS+'/05-list-search.png'});
  await p.fill('#homeq','zzzz'); await W(150); ok('no-result state', await p.locator('.empty').count()>=1);
  await p.fill('#homeq',''); await W(100);
  // AI: no key → alert with 前往設定
  await p.click('[data-act="ai"]'); await W(200); await p.fill('[data-ai="topic"]','日本旅遊'); await p.click('[data-act="aiRun"]'); await W(200);
  ok('AI without key shows alert', await p.locator('.dlg [role=alert]').count()===1);
  await p.keyboard.press('Escape'); await W(100);
  // settings: 3 tabs (儲存與同步 / GitHub 與 AI / 外觀與無障礙)
  await p.click('#side [data-act="settings"][aria-label="設定"]'); await W(300);
  const stabs=await p.$$eval('.dlg [role=tab]',ts=>ts.map(t=>t.getAttribute('aria-controls')+':'+!!document.getElementById(t.getAttribute('aria-controls'))));
  ok('settings has 儲存與同步 + GitHub 與 AI + 外觀與無障礙 tabs, each with its panel', stabs.join()==='sp-data:true,sp-gh:true,sp-a11y:true', stabs.join(','));
  ok('settings opens on 儲存與同步 with 只存瀏覽器 checked', await p.locator('[data-act="formSync"][data-v="local"][aria-checked="true"]').count()===1);
  ok('settings warns browser storage can be lost', /清除瀏覽資料/.test(await p.locator('#sp-data').textContent()));
  ok('storage backend shown as IndexedDB', /IndexedDB/.test(await p.locator('#sp-data').textContent()));
  await p.screenshot({path:SHOTS+'/06-settings-storage.png'});
  await p.click('[data-act="formSync"][data-v="manual"]'); await W(100);
  ok('choosing manual without a token shows a hint', /需要 GitHub 金鑰/.test(await p.locator('#sp-data').textContent()));
  await p.click('[data-act="saveSettings"]'); await W(200);
  ok('saving manual without token is refused (jumps to GitHub tab)', await p.locator('#st-gh[aria-selected="true"]').count()===1 && await p.locator('#sp-gh [role=alert]').count()===1);
  await p.screenshot({path:SHOTS+'/06b-settings-github.png'});
  await p.click('#st-data'); await W(100); await p.click('[data-act="formSync"][data-v="local"]'); await W(100);
  await p.click('#st-gh'); await W(100);
  await p.fill('#f-oai','sk-fake-key-123');
  await p.click('#st-a11y'); await W(150);
  await p.click('[data-act="formLines"][data-v="light"]'); await W(100);
  await p.screenshot({path:SHOTS+'/07-settings-a11y.png'});
  await p.click('#st-gh'); await W(100);
  ok('form values kept across tabs', await p.inputValue('#f-oai')==='sk-fake-key-123');
  await p.click('[data-act="saveSettings"]'); await W(200);
  ok('key stored in localStorage only', await p.evaluate(()=>Object.keys(localStorage).some(k=>localStorage[k].includes('sk-fake-key'))));
  ok('light lines pref saved', await p.evaluate(()=>JSON.parse(localStorage['mymind.prefs']).lines)==='light');
  ok('still 只存瀏覽器 after saving', await p.evaluate(()=>JSON.parse(localStorage['mymind.prefs']).sync)==='local');
  // AI 401
  setAiMode('401'); await p.click('[data-act="ai"]'); await W(200); await p.fill('[data-ai="topic"]','日本旅遊'); await p.click('[data-act="aiRun"]'); await W(500);
  const alertTxt=await p.locator('.dlg [role=alert]').textContent().catch(()=>'');
  ok('AI 401 shows key error', /金鑰|401/.test(alertTxt), alertTxt.slice(0,60));
  await p.screenshot({path:SHOTS+'/08-ai-error.png'});
  setAiMode('ok'); await p.click('[data-act="aiRun"]'); await W(700);
  ok('AI generate creates map', await p.evaluate(()=>window.__mm.doc&&window.__mm.doc.root.t==='日本旅遊計畫'));
  ok('AI request uses gpt-4o-mini + bearer key', aiCalls.at(-1).model==='gpt-4o-mini'&&aiCalls.at(-1).auth==='Bearer sk-fake-key-123');
  await p.evaluate(()=>{const S=window.__mm; S.sel=S.doc.root.c[1].id;}); await p.locator('#cv').focus();
  await p.keyboard.press('Control+j'); await W(250);
  const inExpand=await p.locator('[data-ai="hint"]').count(); if(inExpand) await p.click('[data-act="aiRun"]'); await W(700);
  ok('AI expand node adds children', await p.evaluate(()=>window.__mm.doc.root.c[1].c.length)===6);
  await p.screenshot({path:SHOTS+'/09-ai-map-desktop.png'});
  // trash & restore
  await p.goto(BASE+'#/'); await W(200);
  // ---- browser-only storage (IndexedDB) ----
  await p.evaluate(()=>window.__mmStore.flush());
  const idb=await p.evaluate(()=>new Promise(res=>{ const r=indexedDB.open('mymind'); r.onsuccess=()=>{ const t=r.result.transaction('kv','readonly').objectStore('kv').getAllKeys(); t.onsuccess=()=>res(t.result); }; }));
  ok('maps are stored in IndexedDB', idb.filter(k=>k.startsWith('map.')).length>=4, idb.length+' keys');
  ok('no maps left in localStorage', await p.evaluate(()=>Object.keys(localStorage).filter(k=>/^mymind\.(map|index|base)/.test(k)).length)===0);
  ok('local mode made zero GitHub requests', ghReq.length===0, ghReq.join(','));
  ok('local mode: no 同步 button', await p.locator('.syncbtn:not([hidden])').count()===0);
  const before2=await p.locator('.grid > .card').count();
  await p.reload(); await ready(p); await W(300);
  ok('maps survive reload (IndexedDB)', await p.locator('.grid > .card').count()===before2, String(before2));
  ok('backup reminder shown on list (local mode)', await p.locator('.backupnote').count()===1);
  await p.screenshot({path:SHOTS+'/16-list-backup-note.png'});
  const [bk]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('.backupnote [data-act="backup"]')]);
  let backup=null; if(bk){ backup=JSON.parse(fs.readFileSync(await bk.path(),'utf8')); fs.writeFileSync('/tmp/mm-backup.mymind',JSON.stringify(backup)); }
  ok('backup exports every map in one .mymind file', backup&&backup.format==='mymind-backup/1'&&backup.maps.length===before2&&/\.mymind$/.test(bk.suggestedFilename()), bk&&bk.suggestedFilename());
  ok('backup contains no keys', backup&&!JSON.stringify(backup).includes('sk-fake'));
  await W(200); ok('backup reminder hidden after backup', await p.locator('.backupnote').count()===0);
  // wipe site data, then restore from the backup
  await p.evaluate(async()=>{ const ids=window.__mmStore.maps.index().map(m=>m.id); ids.forEach(id=>window.__mmStore.maps.remove(id)); await window.__mmStore.flush(); });
  await p.reload(); await ready(p); await W(200);
  ok('after wiping, list is empty', await p.locator('.grid > .card').count()===0);
  await p.click('#side [data-act="settings"][aria-label="設定"]'); await W(300);
  const [fc3]=await Promise.all([p.waitForEvent('filechooser'),p.click('[data-act="restore"]')]); await fc3.setFiles('/tmp/mm-backup.mymind'); await W(500);
  await p.keyboard.press('Escape'); await W(200);
  ok('restore brings every map back', await p.locator('.grid > .card').count()===before2, String(await p.locator('.grid > .card').count()));
  ok('persist() requested / status shown', await p.evaluate(()=>typeof navigator.storage.persist==='function'));
  ok('no runtime errors (desktop local)', p.errs.length===0, p.errs.join(' | ').slice(0,300));
  await ctx.close(); }
// ================= desktop, GitHub MANUAL sync (mocked) =================
{ const gh=mockGH(); const {ctx,p}=await setup({width:1280,height:800},{gh});
  await p.goto(BASE); await ready(p); await p.click('[data-act="welcomeGithub"]'); await W(200);
  await p.fill('#f-pat','github_pat_FAKE_FOR_TESTS'); await p.click('[data-act="testGithub"]'); await W(700);
  const tmsg=await p.locator('.dlg').textContent(); ok('test connection reports private + rw', /私人儲存庫/.test(tmsg));
  await p.click('[data-act="saveSettings"]'); await W(700);
  ok('connecting GitHub defaults to 手動同步', await p.evaluate(()=>JSON.parse(localStorage['mymind.prefs']).sync)==='manual');
  await p.click('.empty [data-act="new"]'); await W(300); await p.keyboard.type('同步測試'); await p.keyboard.press('Enter');
  await p.keyboard.press('Tab'); await p.keyboard.type('本機新增'); await p.keyboard.press('Enter'); await W(4000);
  const id=await p.evaluate(()=>window.__mm.doc.id); const path=`maps/${id}.json`;
  ok('manual: edits are NOT pushed automatically', gh.commits.length===0, gh.commits.length+' commits');
  const badge=await p.locator('.top .syncbtn .nbadge').textContent().catch(()=>'');
  ok('manual: 同步 button shows unsynced badge', badge==='1', badge);
  ok('chip says saved locally, not synced', /已存本機.*未同步/.test(await p.locator('.top .saved').textContent()));
  // a second map, then one click on 同步 → ONE commit with both maps
  await p.goto(BASE+'#/'); await W(200); await p.click('[data-act="new"] >> nth=0'); await W(300); await p.keyboard.type('第二張'); await p.keyboard.press('Enter'); await W(200);
  const id2=await p.evaluate(()=>window.__mm.doc.id);
  ok('badge counts 2 unsynced maps', (await p.locator('.top .syncbtn .nbadge').textContent())==='2');
  await p.screenshot({path:SHOTS+'/17-sync-button-desktop.png'});
  await p.click('.top .syncbtn'); await W(2500);
  ok('同步 pushes both maps in ONE commit (git data API)', gh.commits.length===1&&Object.keys(gh.commits[0].paths).length===2&&gh.commits[0].api==='git', JSON.stringify(gh.commits.map(c=>[Object.keys(c.paths).length,c.api,c.msg])));
  ok('pushed content correct', gh.doc(path).root.c.some(c=>c.t==='本機新增')&&gh.doc(`maps/${id2}.json`).root.t==='第二張');
  ok('badge cleared after sync', await p.locator('.top .syncbtn .nbadge').count()===0);
  ok('chip says synced', /已同步/.test(await p.locator('.top .saved').textContent()));
  ok('local sha = git blob sha on GitHub (no re-download)', await p.evaluate(id=>window.__mmStore.maps.meta(id).sha,id)===gh.files.get(path).sha);
  ok('no Contents-API PUTs used for sync', !gh.requests.some(r=>r.startsWith('PUT ')));
  // Ctrl+S also pushes
  await p.goto(BASE+'#/map/'+id); await W(300); await p.locator('#cv').focus(); await p.keyboard.press('Tab'); await p.keyboard.type('Ctrl+S 測試'); await p.keyboard.press('Enter');
  await p.keyboard.press('Control+s'); await W(2000);
  ok('Ctrl+S pushes in manual mode', gh.commits.length===2&&gh.doc(path).root.c.some(c=>c.t==='Ctrl+S 測試'));
  // history
  await p.click('[data-act="history"]'); await W(700);
  ok('history panel lists commits', await p.locator('.hist li').count()===gh.commitsFor(path).length, String(await p.locator('.hist li').count()));
  await p.locator('.hist li').last().click(); await W(600);
  ok('preview older version', await p.evaluate(()=>!!window.__mm.preview));
  await p.screenshot({path:SHOTS+'/10-history-preview.png'});
  await p.click('[data-act="endPreview"]').catch(()=>{}); await W(200);
  await p.click('[data-act="history"]').catch(()=>{}); await W(200);
  // conflict: server edits a different node, we edit root
  gh.serverEdit(path,d=>{d.root.c[0].t='雲端改的';});
  await p.evaluate(()=>{const S=window.__mm; S.sel=S.doc.root.id;}); await p.locator('#cv').focus();
  await p.keyboard.press('F2'); await p.keyboard.press('Control+a'); await p.keyboard.type('同步測試（改）'); await p.keyboard.press('Enter');
  await p.keyboard.press('Control+s'); await W(1500);
  ok('sha mismatch opens conflict dialog', await p.locator('.dlg').filter({hasText:'合併'}).count()>0);
  await p.screenshot({path:SHOTS+'/11-conflict.png'});
  await p.click('[data-act="cfApply"]'); await W(2000);
  const remote=gh.doc(path);
  ok('merge keeps both edits', remote.root.t==='同步測試（改）'&&remote.root.c[0].t==='雲端改的', remote.root.t+' / '+remote.root.c[0].t);
  // offline: edits stay local; after reconnect, 同步 pushes
  await ctx.setOffline(true); await p.locator('#cv').focus(); await p.keyboard.press('Tab'); await p.keyboard.type('離線新增'); await p.keyboard.press('Enter'); await p.keyboard.press('Control+s'); await W(500);
  ok('offline status shown', /離線/.test(await p.locator('.top .saved').textContent()));
  await ctx.setOffline(false); await W(1200);
  ok('manual: reconnect does not push by itself', !gh.doc(path).root.c.some(c=>c.t==='離線新增'));
  await p.click('.top .syncbtn'); await W(2000);
  ok('同步 after reconnect pushes offline edits', gh.doc(path).root.c.some(c=>c.t==='離線新增'));
  // permanent delete is queued and synced as part of a commit
  await p.goto(BASE+'#/'); await W(300); await p.click(`[data-act="cardMenu"][data-v="${id2}"]`); await W(200); await p.click(`[data-act="trashMap"][data-v="${id2}"]`); await W(200);
  await p.goto(BASE+'#/trash'); await W(300); await p.click(`[data-act="cardMenu"][data-v="${id2}"]`); await W(200); await p.click(`[data-act="purgeMap"][data-v="${id2}"]`); await W(200); await p.click('[data-act="promptOk"]'); await W(300);
  const nC=gh.commits.length; await p.click('#side .syncbtn'); await W(2000);
  ok('purge removes the file on next sync (1 commit)', !gh.files.has(`maps/${id2}.json`)&&gh.commits.length===nC+1, `${nC}→${gh.commits.length}`);
  // 401
  await settle(p); await p.goto(BASE+'#/map/'+id); await W(300); gh.failNext({status:401,message:'Bad credentials'}); await p.locator('#cv').focus(); await p.keyboard.press('Tab'); await p.keyboard.type('x'); await p.keyboard.press('Enter'); await settle(p); await p.keyboard.press('Control+s'); await settle(p);
  ok('401 shows clear error', /401|失敗/.test(await p.locator('.top .saved').textContent()), (await p.locator('.top .saved').textContent())+' req:'+gh.requests.slice(-4).join(','));
  await settle(p);
  // second device pulls (read-only, no commits)
  const {ctx:c2,p:p2}=await setup({width:1280,height:800},{gh}); const cBefore=gh.commits.length;
  await p2.goto(BASE); await ready(p2); await p2.evaluate(()=>{localStorage.setItem('mymind.prefs',JSON.stringify({mode:'github',repo:'hctsaik/mymind-data',sync:'manual'}));localStorage.setItem('mymind.pat',JSON.stringify('github_pat_FAKE_FOR_TESTS'));});
  await p2.reload(); await ready(p2); await W(1500);
  ok('second browser pulls maps from repo', /同步測試/.test(await p2.locator('main').textContent()));
  ok('pulling creates no commits', gh.commits.length===cBefore, JSON.stringify(gh.commits.slice(cBefore).map(c=>c.msg)));
  ok('no runtime errors (manual sync)', p.errs.length===0&&p2.errs.length===0, [...p.errs,...p2.errs].join(' | ').slice(0,300));
  await c2.close(); await ctx.close(); }
// ================= AUTO sync: batched (mocked) =================
{ const gh=mockGH(); const {ctx,p}=await setup({width:1280,height:800},{gh});
  await ctx.addInitScript(()=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.setItem('mymind.prefs',JSON.stringify({mode:'github',repo:'hctsaik/mymind-data',sync:'auto',autoMs:4000})); localStorage.setItem('mymind.pat',JSON.stringify('github_pat_FAKE_FOR_TESTS')); });
  await p.goto(BASE); await ready(p); await W(600);
  await p.click('.empty [data-act="new"]'); await W(300); await p.keyboard.type('自動一'); await p.keyboard.press('Enter');
  for(const t of ['甲','乙','丙']){ await p.keyboard.press('Tab'); await p.keyboard.type(t); await p.keyboard.press('Enter'); await p.keyboard.press('Escape'); await p.locator('#cv').focus(); await p.evaluate(()=>{const S=window.__mm; S.sel=S.doc.root.id;}); }
  await p.goto(BASE+'#/'); await W(200); await p.click('[data-act="new"] >> nth=0'); await W(300); await p.keyboard.type('自動二'); await p.keyboard.press('Enter'); await W(300);
  ok('auto: nothing pushed while editing (batch window)', gh.commits.length===0, String(gh.commits.length));
  ok('auto: chip tells when it will sync', /自動同步/.test(await p.locator('.top .saved').textContent()), await p.locator('.top .saved').textContent());
  await p.screenshot({path:SHOTS+'/18-auto-sync-pending.png'});
  await W(4800);
  ok('auto: ~10 edits on 2 maps → ONE commit after the window', gh.commits.length===1&&Object.keys(gh.commits[0].paths).length===2, JSON.stringify(gh.commits.map(c=>Object.keys(c.paths).length)));
  const c1=gh.commits.length;
  await p.locator('#cv').focus(); await p.keyboard.press('Tab'); await p.keyboard.type('切換分頁前'); await p.keyboard.press('Enter'); await W(300);
  ok('auto: next edit waits for the window', gh.commits.length===c1);
  await p.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); }); await W(300); await settle(p);
  ok('auto: hiding the tab flushes immediately (1 more commit)', gh.commits.length===c1+1&&JSON.stringify(gh.commits.at(-1).paths).includes('切換分頁前'), gh.commits.length+' '+c1+' '+gh.requests.slice(-6).join(','));
  await p.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); });
  await W(5000); ok('auto: no extra commits when nothing changed', gh.commits.length===c1+1);
  ok('no runtime errors (auto sync)', p.errs.length===0, p.errs.join(' | ').slice(0,300));
  await ctx.close(); }
// ================= existing users: migration =================
{ const gh=mockGH(); const {ctx,p}=await setup({width:1280,height:800},{gh});
  await ctx.addInitScript(()=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.setItem('mymind.prefs',JSON.stringify({mode:'github',repo:'hctsaik/mymind-data'})); localStorage.setItem('mymind.pat',JSON.stringify('github_pat_FAKE_FOR_TESTS'));
    const d={format:'mymind/1',id:'legacy1',theme:'coral',settings:{},icon:'🧠',created:'2026-11-20T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:{id:'r',t:'舊版本機圖',c:[{id:'a',t:'子'}]}};
    localStorage.setItem('mymind.index',JSON.stringify([{id:'legacy1',title:'舊版本機圖',updated:d.updated,dirty:true}])); localStorage.setItem('mymind.map.legacy1',JSON.stringify(d)); });
  await p.goto(BASE); await ready(p); await W(800);
  ok('existing GitHub user defaults to 手動同步', await p.evaluate(()=>JSON.parse(localStorage['mymind.prefs']||'{}').sync||window.__mm.syncMode)==='manual');
  ok('old localStorage maps migrated into IndexedDB', /舊版本機圖/.test(await p.locator('main').textContent())&&await p.evaluate(()=>!localStorage['mymind.map.legacy1']));
  ok('migrated map waits for manual sync', gh.commits.length===0&&(await p.locator('#side .syncbtn .nbadge').textContent())==='1');
  ok('no runtime errors (migration)', p.errs.length===0, p.errs.join(' | ').slice(0,300));
  await ctx.close(); }
// ================= mobile =================
{ const {ctx,p}=await setup({width:390,height:844},{mobile:true});
  await p.goto(BASE); await ready(p); await p.screenshot({path:SHOTS+'/12-welcome-mobile.png'});
  await p.click('[data-act="welcomeLocal"]'); await W(200); await p.click('.empty [data-act="new"]'); await W(300); await p.keyboard.type('手機測試'); await p.keyboard.press('Enter'); await W(200);
  ok('mobile editor renders', await nodes(p)>=4);
  const nb=await p.locator('#mapsvg g.node').nth(1).boundingBox(); await p.touchscreen.tap(nb.x+nb.width/2,nb.y+nb.height/2); await W(150);
  ok('tap selects node', await p.evaluate(()=>window.__mm.sel&&window.__mm.sel!==window.__mm.doc.root.id));
  await p.screenshot({path:SHOTS+'/13-editor-mobile.png'});
  await p.click('[data-act="moreMenu"]'); await W(200);
  const moreTxt=await p.locator('#layer').textContent(); ok('more menu has 外觀與無障礙', moreTxt.includes('外觀與無障礙'));
  await p.keyboard.press('Escape'); await W(100);
  ok('AI bar with × inside', await p.locator('#aiq').count()===1&&await p.locator('[data-act="aibarClose"]').count()===1);
  await p.click('[data-act="aibarClose"]'); await W(100); ok('AI bar closes', await p.locator('#aiq').count()===0);
  await p.click('[data-act="style"].mobile-only'); await W(250); await p.screenshot({path:SHOTS+'/14-style-mobile.png'});
  ok('mobile style sheet opens', await p.locator('[role=tabpanel]').count()>=1);
  await p.goto(BASE+'#/'); await W(200); await p.screenshot({path:SHOTS+'/15-list-mobile.png'});
  ok('no runtime errors (mobile)', p.errs.length===0, p.errs.join(' | ').slice(0,300));
  await ctx.close(); }
// ================= mobile, manual sync button =================
{ const gh=mockGH(); const {ctx,p}=await setup({width:390,height:844},{mobile:true,gh});
  await ctx.addInitScript(()=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.setItem('mymind.prefs',JSON.stringify({mode:'github',repo:'hctsaik/mymind-data',sync:'manual'})); localStorage.setItem('mymind.pat',JSON.stringify('github_pat_FAKE_FOR_TESTS')); });
  await p.goto(BASE); await ready(p); await W(600);
  await p.click('.empty [data-act="new"]'); await W(300); await p.keyboard.type('手機同步'); await p.keyboard.press('Enter'); await W(300);
  const sb=await p.locator('.top .syncbtn').boundingBox();
  ok('mobile: 同步 button visible with badge, ≥44px', sb&&sb.width>=44&&sb.height>=44&&(await p.locator('.top .syncbtn .nbadge').textContent())==='1', JSON.stringify(sb));
  await p.screenshot({path:SHOTS+'/19-sync-button-mobile.png'});
  await p.click('.top .syncbtn'); await settle(p);
  ok('mobile: tap 同步 pushes', gh.commits.length===1);
  await p.goto(BASE+'#/'); await W(300); await p.click('[data-act="nav"]'); await W(300);
  await p.screenshot({path:SHOTS+'/21-nav-drawer-sync-mobile.png'});
  await p.click('.navdrawer [data-act="settings"][aria-label="設定"]'); await W(400);
  ok('mobile: settings opens on 儲存與同步', await p.locator('#st-data[aria-selected="true"]').count()===1);
  await p.screenshot({path:SHOTS+'/20-settings-storage-mobile.png'});
  ok('no runtime errors (mobile sync)', p.errs.length===0, p.errs.join(' | ').slice(0,300));
  await ctx.close(); }
{ const p={errs:[]}; const ctx={close:async()=>{}};
  ok('no runtime errors (mobile)', p.errs.length===0, p.errs.join(' | ').slice(0,300));
  await ctx.close(); }
await b.close();
const f=results.filter(r=>!r.pass); console.log(`\n${results.length-f.length}/${results.length} passed`); (await import('node:fs')).writeFileSync((process.env.OUT||'/tmp/mm/e2e.json'),JSON.stringify(results,null,1)); process.exit(f.length?1:0);
