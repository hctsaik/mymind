// Restoring a multi-map backup on a phone in Google Drive mode: adds the maps without touching the ones already here,
// keeps each map's theme and look, queues them for the next Drive upload, and the slide-out menu shows the new list.
// Run: BASE=http://localhost:8765/ node tests/restore-merge.mjs
import { chromium } from 'playwright-core';
import { mockDrive, GIS_STUB } from './drive-mock.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/';
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const N=(id,t,c)=>({id,t,...(c?{c}:{})});
const doc=(id,title,theme,kids,extra={})=>({format:'mymind/1',id,theme,settings:{layout:'right'},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:{...N(id+'r',title,kids),...extra}});
const mine=[doc('own1','我原本的圖','coral',[N('o2','甲'),N('o3','乙')]),doc('own2','另一張','latte',[N('p2','丙')])];
const gs={v:1,bg:'#f5f9fc',maxW:400,layout:'right',lv:[{fs:20},{fs:16},{fs:14}],assets:{}};
const add=[doc('imp1','匯入一','classic',[N('i1','子一',[N('i2','孫')]),N('i3','子二')],{gs}),doc('imp2','匯入二','classic',[N('j1','子')],{gs}),doc('own2','另一張（較舊）','classic',[],{})];
add[2].updated='2026-11-01T00:00:00Z'; // older than the one on the phone → kept
const file=path.join(os.tmpdir(),'restore-merge-test.mymind'); fs.writeFileSync(file,JSON.stringify({format:'mymind-backup/1',exported:'2026-11-22T00:00:00Z',count:add.length,maps:add}));
const b=await chromium.launch({executablePath:exe});
const ctx=await b.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const drive=mockDrive({email:'someone@example.com'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:GIS_STUB}));
await ctx.route('https://www.googleapis.com/**',drive.handler);
await ctx.addInitScript(({mine})=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.clear();
  localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'manual',backend:'drive',driveEmail:'someone@example.com'}));
  localStorage.setItem('mymind.index',JSON.stringify(mine.map(d=>({id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created,dirty:true})))); mine.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{mine});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'?nosw'); await p.waitForSelector('body[data-ready="1"]'); await W(400);
const sync=async()=>{ await p.evaluate(()=>{ const e=[...document.querySelectorAll('[data-act="syncNow"]')].find(e=>e.offsetParent!==null)||document.querySelector('[data-act="syncNow"]'); e.click(); }); await W(400); await p.waitForFunction(()=>window.__mm.sync.state!=='saving',null,{timeout:20000}).catch(()=>{}); await W(800); };
await sync(); ok('setup: the two existing maps are on Drive',await p.evaluate(()=>window.__mm.unsynced===0&&window.__mm.sync.state==='saved'));
const tap=async sel=>{ await p.evaluate(s=>{ const e=[...document.querySelectorAll(s)].find(e=>e.offsetParent!==null); e&&e.scrollIntoView({block:'center'}); },sel); await W(250); const xy=await p.evaluate(s=>{ const e=[...document.querySelectorAll(s)].find(e=>e.offsetParent!==null); const r=e.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; },sel); await p.touchscreen.tap(...xy); await W(400); };
await tap('[data-act="nav"]'); await tap('.navdrawer [data-act="settings"]');
const fc=p.waitForEvent('filechooser'); await tap('[data-act="restore"]'); await (await fc).setFiles(file); await W(1200);
const st=await p.evaluate(()=>{ const m=window.__mmStore.maps; const idx=m.index(); const c=n=>1+(n.c||[]).reduce((a,k)=>a+c(k),0);
  return {n:idx.length, own1:!!m.load('own1'), own2:m.load('own2')&&m.load('own2').root.t, imp1:m.load('imp1')&&{nodes:c(m.load('imp1').root),theme:m.load('imp1').theme,gs:!!m.load('imp1').root.gs}, dirty:idx.filter(x=>x.dirty).map(x=>x.id).sort(), toast:document.querySelector('#toast')?.textContent||''}; });
ok('restore adds the new maps and keeps every existing one',st.n===4&&st.own1&&st.own2==='另一張',JSON.stringify(st));
ok('a map that is newer on the phone is kept, and the toast says so',/新增 2 張/.test(st.toast)&&/1 張本機較新/.test(st.toast),st.toast);
ok('imported map keeps its node count, theme and own look',st.imp1&&st.imp1.nodes===4&&st.imp1.theme==='classic'&&st.imp1.gs,JSON.stringify(st.imp1));
ok('only the added maps are queued for the next Drive upload',JSON.stringify(st.dirty)==='["imp1","imp2"]',JSON.stringify(st.dirty));
await tap('.close[data-act="closeDialog"]');
const dr=await p.evaluate(()=>{ const d=document.querySelector('.navdrawer .side'); return d?{files:d.querySelectorAll('.file').length,count:(d.textContent.match(/所有心智圖\s*(\d+)/)||[])[1],unsync:(d.querySelector('.syncbtn')||{}).textContent||''}:null; });
ok('the open phone menu shows the new list and the 2 waiting uploads',dr&&dr.files===4&&dr.count==='4'&&/2/.test(dr.unsync),JSON.stringify(dr));
await sync(); const names=[...drive.files.values()].filter(f=>!f.trashed&&/\.mymind$/.test(f.name||'')).map(f=>f.name).sort();
ok('next sync uploads them: 4 maps on Drive, nothing waiting',names.length===4&&names.includes('imp1.mymind')&&await p.evaluate(()=>window.__mm.unsynced===0),names.join(','));
ok('no page errors',!errs.length,errs.join(' | ')); await b.close(); fs.unlinkSync(file);
const n=res.filter(Boolean).length; console.log(`${n}/${res.length} passed`); process.exit(n===res.length?0:1);
