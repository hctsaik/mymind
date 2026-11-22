// v1.8.1 快速樣式: one-tap node presets from the desktop style panel and the phone node menu, in 珊瑚 and 經典蜜桃,
// with 清除樣式, 複製/貼上樣式, undo, AA text contrast for every preset, SVG export and the share viewer.
// Run: BASE=http://localhost:8765/ node tests/quickstyle.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push([n,!!c]);console.log((c?'PASS ':'FAIL ')+n+(i&&!c?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const N=(id,t,c,x={})=>({id,t,...(c?{c}:{}),...x});
const tree=p=>N(p+'0','根',[N(p+'1','甲',[N(p+'11','甲一'),N(p+'12','甲二')]),N(p+'2','乙'),N(p+'3','丙'),N(p+'4','丁',[],{hl:'#FFE58F'})]);
const gs={v:1,bg:'#f5f9fc',maxW:400,layout:'right',lv:[{fs:20,fill:'#2f6fd0',color:'#ffffff',r:8},{fs:16,fill:'#e8f0fd',color:'#1f2329',r:6},{fs:14,color:'#1f2329'}],assets:{}};
const docs=[{format:'mymind/1',id:'qa',theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:tree('a')},
  {format:'mymind/1',id:'qb',theme:'classic',settings:{layout:'right'},icon:'🍑',created:'2026-11-01T00:00:00Z',updated:'2026-11-19T00:00:00Z',root:{...tree('b'),gs}},
  {format:'mymind/1',id:'qc',theme:'midnight',settings:{},icon:'🌙',created:'2026-11-01T00:00:00Z',updated:'2026-11-18T00:00:00Z',root:tree('c')}];
const seed=async ctx=>{ await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.addInitScript(({docs})=>{ if(localStorage.getItem('qs.seeded')) return; localStorage.clear(); localStorage.setItem('qs.seeded','1'); localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'}));
  localStorage.setItem('mymind.index',JSON.stringify(docs.map(d=>({id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created})))); docs.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{docs}); };
// WCAG contrast of a node's label against its box (or the canvas when the box is unfilled)
const contrast=(p,id)=>p.evaluate(id=>{ const g=document.querySelector(`#mapsvg g.node[data-id="${id}"]`); if(!g) return null;
  const hex=c=>{ if(/^#[0-9a-f]{6}$/i.test(c)) return [1,3,5].map(i=>parseInt(c.slice(i,i+2),16)); const m=String(c).match(/\d+(\.\d+)?/g); if(!c||c==='none'||!m) return null; return m.slice(0,3).map(Number); };
  const css=e=>e&&getComputedStyle(e); const box=[g.querySelector('[data-g="node"]')].find(e=>{ const f=e&&e.getAttribute('fill'); return f&&f!=='none'&&f!=='transparent'; });
  const cvs=document.querySelector('#cv'); const cbg=hex(getComputedStyle(cvs).backgroundColor); const db=g.querySelector('text')?.getAttribute('data-bg'); const bg=db&&hex(db)?hex(db):box?hex(css(box).fill):(cbg&&getComputedStyle(cvs).backgroundColor!=='rgba(0, 0, 0, 0)'?cbg:[255,255,255]);
  const tx=g.querySelector('text'); const fg=hex(css(tx).fill);
  const L=a=>{ const [r,g2,b]=a.map(v=>{ v/=255; return v<=.03928?v/12.92:((v+.055)/1.055)**2.4; }); return .2126*r+.7152*g2+.0722*b; };
  const a=L(fg),b=L(bg); return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),fg,bg}; },id);
const node=(p,id)=>p.evaluate(id=>{ const f=n=>n.id===id?n:(n.c||[]).map(f).find(Boolean); return JSON.parse(JSON.stringify(f(window.__mm.doc.root)||null)); },id);
const b=await chromium.launch({executablePath:exe});
// ---------- desktop ----------
{ const ctx=await b.newContext({viewport:{width:1280,height:800},acceptDownloads:true}); await seed(ctx);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  for(const [id,P,label] of [['qa','a','珊瑚'],['qb','b','經典蜜桃'],['qc','c','深色']]){
    await p.goto(BASE+'?nosw#/map/'+id); await p.waitForSelector('#mapsvg g.node'); await W(300);
    await p.click(`#mapsvg g.node[data-id="${P}2"]`); await W(150);
    if(!await p.locator('#panelHost [role=tab]').count()){ await p.click('[data-act="style"]'); await W(300); }
    const nodeTab=p.locator('#panelHost [role=tab]').filter({hasText:'節點'}); if(await nodeTab.count()) { await nodeTab.first().click(); await W(200); }
    const keys=await p.$$eval('#panelHost .qsgrid [data-act="qs"]',e=>e.map(x=>x.dataset.v));
    ok(`${label}: style panel shows the 快速樣式 grid (≥8 presets + 清除樣式)`,keys.filter(Boolean).length>=8&&keys.includes(''),keys.join(','));
    const bad=[];
    for(const k of keys.filter(Boolean)){ await p.click(`#panelHost .qsgrid [data-act="qs"][data-v="${k}"]`); await W(120); const n=await node(p,P+'2'); const c=await contrast(p,P+'2'); if(n.qs!==k||!c||c.ratio<4.5) bad.push(k+':'+(c&&c.ratio.toFixed(2))); }
    ok(`${label}: every preset applies and keeps AA text contrast (≥4.5)`,!bad.length,bad.join(' '));
    await p.click(`#panelHost .qsgrid [data-act="qs"][data-v="key"]`); await W(120);
    const k1=await p.evaluate(P=>document.querySelector(`#mapsvg g.node[data-id="${P}2"]`).outerHTML,P);
    await p.click(`#panelHost .qsgrid [data-act="qs"][data-v="concl"]`); await W(120);
    ok(`${label}: presets look different from each other`,k1!==await p.evaluate(P=>document.querySelector(`#mapsvg g.node[data-id="${P}2"]`).outerHTML,P));
    await p.keyboard.press('Control+z'); await W(150); ok(`${label}: Ctrl+Z undoes a preset`,(await node(p,P+'2')).qs==='key');
    // copy → paste onto 丁 (which had a highlight) replaces its look
    await p.click('#panelHost [data-act="qsCopy"]'); await W(120); await p.click(`#mapsvg g.node[data-id="${P}4"]`); await W(200);
    await p.click('#panelHost [data-act="qsPaste"]'); await W(150); const d=await node(p,P+'4');
    ok(`${label}: 複製樣式 / 貼上樣式`,d.qs==='key'&&!d.hl,JSON.stringify(d));
    await p.click(`#panelHost .qsgrid [data-act="qs"][data-v=""]`); await W(150); const e=await node(p,P+'4');
    ok(`${label}: 清除樣式 removes preset and highlight`,!e.qs&&!e.hl&&!e.color,JSON.stringify(e));
    await p.keyboard.press('Control+z'); await W(150);
    if(SHOTS) await p.screenshot({path:`${SHOTS}/qs-desktop-${id}.png`});
    // the preset survives a reload (stored) and shows in SVG export and the share viewer
    await p.reload(); await p.waitForSelector('#mapsvg g.node'); await W(300); { const a=await node(p,P+'2'), d=await node(p,P+'4'); ok(`${label}: preset persists after reload`,a.qs==='key'&&d.qs==='key',JSON.stringify([a,d])); }
    const look=await p.evaluate(P=>document.querySelector(`#mapsvg g.node[data-id="${P}2"] [data-g="node"]`)?.getAttribute('fill'),P);
    await p.click('[data-act="exportMenu"]'); const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#layer [data-act="exp"][data-v="svg"]')]); const svg=fs.readFileSync(await dl.path(),'utf8');
    ok(`${label}: SVG export carries the preset look`,!!look&&svg.includes(look),look+' '+svg.length);
    const link=await p.evaluate(async()=>{ const SH=await import('./js/share.js'); return SH.inlineLink(location.href.split('#')[0],await SH.seal(SH.snapshot(window.__mm.doc))); });
    const v=await ctx.newPage(); await v.goto(link); await v.waitForFunction(()=>document.body.dataset.ready==='1');
    ok(`${label}: share viewer draws the preset`,await v.evaluate(([P,look])=>document.querySelector(`#mapsvg g.node[data-id="${P}2"]`)?.innerHTML.includes(look),[P,look])); await v.close();
  }
  ok('desktop: no page errors',!errs.length,errs.join(' | ')); await ctx.close(); }
// ---------- phone ----------
{ const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}); await seed(ctx);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const cdp=await ctx.newCDPSession(p);
  const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y],i)=>({x,y,id:i}))});
  const vis=sel=>p.evaluate(s=>{ const e=[...document.querySelectorAll(s)].find(e=>{ const r=e.getBoundingClientRect(); return r.width>0&&r.height>0; }); if(!e) return null; const r=e.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2,r.width,r.height]; },sel);
  const tap=async sel=>{ const xy=await vis(sel); if(!xy) throw new Error('not visible '+sel); await p.touchscreen.tap(xy[0],xy[1]); await W(350); };
  for(const [id,P,label] of [['qa','a','珊瑚'],['qb','b','經典蜜桃']]){
    await p.goto(BASE+'?nosw#/map/'+id); await p.waitForSelector('#mapsvg g.node'); await W(500);
    const xy=await vis(`#mapsvg g.node[data-id="${P}3"]`); await touch('touchStart',[[xy[0],xy[1]]]); await W(750); await touch('touchEnd',[]); await W(400);
    const has=!!await vis('#layer [data-act="quickStyle"]'); ok(`phone ${label}: node menu has 快速樣式`,has);
    if(!has) continue;
    await tap('#layer [data-act="quickStyle"]'); await W(200);
    const sizes=await p.$$eval('#layer .qsmenu [data-act="qs"]',e=>e.map(x=>{ const r=x.getBoundingClientRect(); return [x.dataset.v,Math.round(r.width),Math.round(r.height),r.left>=0&&r.right<=innerWidth]; }));
    ok(`phone ${label}: palette fits the screen with ≥44px targets`,sizes.length>=9&&sizes.every(s=>s[1]>=44&&s[2]>=44&&s[3]),JSON.stringify(sizes));
    if(SHOTS) await p.screenshot({path:`${SHOTS}/qs-phone-${id}.png`});
    await tap('#layer .qsmenu [data-act="qs"][data-v="done"]'); await W(200);
    ok(`phone ${label}: one tap applies 完成 and closes the menu`,(await node(p,P+'3')).qs==='done'&&!await vis('#layer .qsmenu'));
    const c=await contrast(p,P+'3'); ok(`phone ${label}: AA contrast on the map`,c&&c.ratio>=4.5,JSON.stringify(c));
    if(SHOTS) await p.screenshot({path:`${SHOTS}/qs-phone-${id}-applied.png`});
  }
  ok('phone: no page errors',!errs.length,errs.join(' | ')); await ctx.close(); }
await b.close(); const pass=res.filter(r=>r[1]).length; console.log(`${pass}/${res.length} passed`); process.exit(pass===res.length?0:1);
