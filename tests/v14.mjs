// v1.4 checks: layouts, editable outline, node details (tags, colour, link, image), icon picker. Run: BASE=http://localhost:8765/ node tests/v14.mjs
import { chromium } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/';
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({executablePath:exe});
const doc={format:'mymind/1',id:'t14',theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',
  root:{id:'r',t:'根',c:[{id:'a',t:'甲',c:[{id:'a1',t:'甲一'}]},{id:'b',t:'乙'},{id:'c',t:'丙'},{id:'d',t:'丁'}]}};
for(const mobile of [false,true]){ const tag=mobile?'[mobile] ':'';
  const ctx=await b.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:900}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.route('https://example.com/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#9CC9F5"/></svg>'}));
  await ctx.addInitScript(d=>{ if(sessionStorage.s) return; sessionStorage.s=1; localStorage.clear(); localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'})); localStorage.setItem('mymind.index',JSON.stringify([{id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created}])); localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d)); },doc);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'?nosw#/map/t14'); await p.waitForSelector('body[data-ready="1"]'); await W(400);
  const R=()=>p.evaluate(()=>JSON.parse(JSON.stringify(window.__mm.doc.root)));
  const click=(sel)=>p.evaluate(s=>{ const e=[...document.querySelectorAll(s)].find(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed'); if(!e) throw new Error('no '+s); e.click(); },sel);
  // layouts
  await click('[data-act="style"]'); await W(250); await p.evaluate(()=>[...document.querySelectorAll('[role=tab]')].find(x=>/版面/.test(x.textContent))?.click()); await W(200);
  await click('.lyt[data-v="balanced"]'); await W(300);
  const sides=await p.evaluate(()=>{ const m=window.__mm; const r=m.doc.root; return [m.doc.settings.layout]; });
  ok(tag+'layout choice saved in the map file',sides[0]==='balanced');
  const xs=await p.evaluate(()=>[...document.querySelectorAll('#mapsvg g.node[aria-level="2"]')].map(g=>g.getBoundingClientRect().x));
  const rx=await p.evaluate(()=>document.querySelector('#mapsvg g.node[aria-level="1"]').getBoundingClientRect().x);
  ok(tag+'balanced: branches on both sides of the root',xs.some(x=>x<rx)&&xs.some(x=>x>rx),JSON.stringify(xs.map(Math.round))+' root '+Math.round(rx));
  await click('.lyt[data-v="org"]'); await W(300);
  const ys=await p.evaluate(()=>[...document.querySelectorAll('#mapsvg g.node[aria-level="2"]')].map(g=>Math.round(g.getBoundingClientRect().y)));
  ok(tag+'org: first-level topics in one row below the root',new Set(ys).size===1,JSON.stringify(ys));
  await click('[data-act="closePanel"],.sheet [data-act="style"],.stylep [data-act="style"]').catch(()=>{}); await W(200);
  await p.evaluate(()=>{ window.__mm.panel=''; });
  // outline editing
  await p.evaluate(()=>window.__mm.sel='b'); await click('[data-act="outline"]'); await W(300);
  ok(tag+'outline shows one editable row per node',await p.locator('.olin').count()===6);
  await p.locator('.olin[data-olid="b"]').focus(); await p.keyboard.press('Tab'); await W(250);
  let r=await R(); ok(tag+'Tab indents (乙 under 甲)',r.c[0].c.some(n=>n.id==='b'));
  await p.keyboard.press('Shift+Tab'); await W(250); r=await R(); ok(tag+'Shift+Tab outdents back',r.c.some(n=>n.id==='b'));
  await p.keyboard.press('End'); await p.keyboard.type('二'); await W(500); r=await R(); ok(tag+'typing edits the node text',r.c.find(n=>n.id==='b').t==='乙二');
  await p.keyboard.press('Enter'); await W(250); await p.keyboard.type('新'); await W(500); r=await R(); ok(tag+'Enter adds a sibling below',r.c.some(n=>n.t==='新'));
  await p.keyboard.press('Control+z'); await W(250); await p.keyboard.press('Escape'); await W(300);
  ok(tag+'Esc returns to the map',await p.locator('.olin').count()===0&&await p.locator('#mapsvg').count()===1);
  // node details
  await p.evaluate(()=>window.__mm.sel='c'); await p.keyboard.press('Control+Alt+m'); await W(400);
  ok(tag+'details panel has note, link, tags, colour and image sections',await p.locator('.nsec').count()===5);
  await p.fill('#tagin','重要'); await p.keyboard.press('Enter'); await W(250);
  await p.fill('#linkin','example.com/x'); await p.keyboard.press('Enter'); await W(250);
  await click('.csw[data-v="0"]'); await W(250);
  r=await R(); const c=r.c.find(n=>n.id==='c');
  ok(tag+'tag, link (https added) and colour saved',JSON.stringify(c.tags)==='["重要"]'&&c.link==='https://example.com/x'&&c.color===0,JSON.stringify(c));
  ok(tag+'map shows the tag chip and link icon',await p.evaluate(()=>{ const g=document.querySelector('#mapsvg g.node[data-id="c"]'); return /#重要/.test(g.textContent)&&!!g.querySelector('a.linkic[href="https://example.com/x"]'); }));
  await p.fill('#linkin','javascript:alert(1)'); await p.keyboard.press('Enter'); await W(250); r=await R();
  ok(tag+'non-web links are refused',r.c.find(n=>n.id==='c').link==='https://example.com/x');
  await p.fill('#imgurl','https://example.com/a.jpg'); await p.keyboard.press('Enter'); await W(300); r=await R();
  ok(tag+'image by web address (size read from the image)',r.c.find(n=>n.id==='c').img?.src==='https://example.com/a.jpg'&&r.c.find(n=>n.id==='c').img.w===300);
  // icon picker
  await p.evaluate(()=>{ window.__mm.panel=''; }); await p.keyboard.press('Escape'); await W(150);
  await p.evaluate(()=>window.__mm.sel='d'); await p.keyboard.press('Alt+i'); await W(300);
  if(!await p.locator('#emgrid').count()){ await p.evaluate(()=>{ const g=document.querySelector('#mapsvg g.node[data-id="d"]'), r=g.getBoundingClientRect(); g.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})); }); await W(250); await click('[data-act="icons"]'); await W(300); }
  await p.fill('#em-q','錢'); await W(250); const first=await p.locator('#emgrid .emb').first().getAttribute('data-v');
  await p.locator('#emgrid .emb').first().click(); await W(250); r=await R();
  ok(tag+'icon picker search + pick sets the icon',!!first&&r.c.find(n=>n.id==='d').icon===first,first);
  ok(tag+'no page errors',!errs.length,errs.join(' | '));
  await ctx.close(); }
await b.close(); console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean)?0:1);
