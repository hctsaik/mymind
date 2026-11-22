// v1.8.1 desktop: 全部展開／全部收合 (canvas level bar + Ctrl+Alt+] / [), vector icon marks in the default and classic
// renderers, SVG export, Markdown export and the share viewer. Run: BASE=http://localhost:8765/ node tests/v181-desktop.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/';
const res=[]; const ok=(n,c,i='')=>{res.push([n,!!c]);console.log((c?'PASS ':'FAIL ')+n+(i&&!c?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const N=(id,t,c,x={})=>({id,t,...(c?{c}:{}),...x});
const tree=p=>N(p+'0','根',[N(p+'1','甲',[N(p+'11','甲一',[N(p+'111','甲一一')]),N(p+'12','甲二')],{icon:'mm:prog:75'}),N(p+'2','乙',[N(p+'21','乙一')],{icon:'mm:flag:green',pri:8}),N(p+'3','丙',[],{icon:'mm:mon:3'}),N(p+'4','丁',[],{icon:'🔥'})]);
const gs={v:1,bg:'#f5f9fc',maxW:400,layout:'right',lv:[{fs:20,fill:'#2f6fd0',color:'#ffffff',r:8},{fs:16,fill:'#e8f0fd',color:'#1f2329',r:6},{fs:14,color:'#1f2329'}],assets:{}};
const docs=[{format:'mymind/1',id:'ka',theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:tree('a')},
  {format:'mymind/1',id:'kb',theme:'classic',settings:{layout:'right'},icon:'🍑',created:'2026-11-01T00:00:00Z',updated:'2026-11-19T00:00:00Z',root:{...tree('b'),gs}}];
const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1280,height:800},acceptDownloads:true});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await ctx.addInitScript(({docs})=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.clear(); localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'}));
  localStorage.setItem('mymind.index',JSON.stringify(docs.map(d=>({id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created})))); docs.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{docs});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const folded=()=>p.evaluate(()=>{ const o=[]; (function w(n){ if(n.c&&n.c.length){ if(n.collapsed) o.push(n.id); n.c.forEach(w); } })(window.__mm.doc.root); return o.sort().join(','); });
for(const [id,P,label] of [['ka','a','珊瑚'],['kb','b','經典蜜桃']]){
  await p.goto(BASE+'#/map/'+id); await p.waitForSelector('#mapsvg g.node'); await W(300);
  ok(`${label}: vector marks drawn (progress, flag, month) + emoji`,await p.evaluate(P=>['1','2','3'].every(k=>document.querySelector(`#mapsvg g.node[data-id="${P+k}"] g[data-g="icon"]`))&&/🔥/.test(document.querySelector(`#mapsvg g.node[data-id="${P}4"]`).textContent),P));
  ok(`${label}: priority 8 badge`,await p.evaluate(P=>/8/.test(document.querySelector(`#mapsvg g.node[data-id="${P}2"]`).textContent),P));
  await p.click('.levels [data-act="collapseAll"]'); await W(200);
  ok(`${label}: level bar 全部收合 folds every branch below the first level`,await folded()===[P+'1',P+'11',P+'2'].sort().join(',')&&await p.locator(`#mapsvg g.node[data-id="${P}1"]`).count()===1);
  await p.keyboard.press('Control+z'); await W(200); ok(`${label}: Ctrl+Z undoes it`,await folded()==='');
  await p.click('#cv'); await p.keyboard.press('Control+Alt+BracketLeft'); await W(200); const a=await folded();
  await p.keyboard.press('Control+Alt+BracketRight'); await W(200); ok(`${label}: Ctrl+Alt+[ / ] collapse and expand all`,a.split(',').length===3&&await folded()==='',a);
  await p.click('.levels [data-act="expandAll"]'); await W(200); ok(`${label}: 全部展開 when already open says so`,/已經全部展開/.test(await p.locator('#toast').textContent()));
  // SVG export carries the vector marks
  await p.click('[data-act="exportMenu"]'); const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#layer [data-act="exp"][data-v="svg"]')]); const svg=fs.readFileSync(await dl.path(),'utf8');
  ok(`${label}: SVG export includes the marks`,(svg.match(/data-g="icon"/g)||[]).length>=3,String((svg.match(/data-g="icon"/g)||[]).length));
  await p.click('[data-act="exportMenu"]'); const [dp]=await Promise.all([p.waitForEvent('download'),p.click('#layer [data-act="exp"][data-v="png"]')]); ok(`${label}: PNG export works`,fs.statSync(await dp.path()).size>2000);
  // share viewer (inline link) shows the same marks
  const link=await p.evaluate(async()=>{ const SH=await import('./js/share.js'); return SH.inlineLink(location.href.split('#')[0],await SH.seal(SH.snapshot(window.__mm.doc))); });
  const v=await ctx.newPage(); await v.goto(link); await v.waitForFunction(()=>document.body.dataset.ready==='1');
  ok(`${label}: share viewer draws the marks`,await v.evaluate(P=>['1','2','3'].every(k=>document.querySelector(`#mapsvg g.node[data-id="${P+k}"] g[data-g="icon"]`)),P)); await v.close();
}
const md=await p.evaluate(async()=>{ const IO=await import('./js/io.js'); return Object.keys(IO).filter(k=>/md|markdown/i.test(k)).map(k=>{ try{ return String(IO[k](window.__mm.doc.root)); }catch{ return ''; } }).join('\n'); });
ok('Markdown export writes emoji stand-ins for marks',/🚩/.test(md)&&/◔75%/.test(md)&&/📅3月/.test(md),md.slice(0,200));
ok('no page errors',errs.length===0,errs.join(' | '));
await b.close(); const pass=res.filter(r=>r[1]).length; console.log(`${pass}/${res.length} passed`); process.exit(pass===res.length?0:1);
