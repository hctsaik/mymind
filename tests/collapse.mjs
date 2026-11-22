// v1.7.2: folding branches works everywhere: the selected node shows a "−" toggle (default and 經典蜜桃 maps), the count badge
// expands again, Ctrl+. toggles, the phone node bar has 收合／展開, and unselected nodes render exactly as before.
// Run: BASE=http://localhost:8765/ node tests/collapse.mjs
import { chromium } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/';
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(i&&!c?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const N=(id,t,c,x={})=>({id,t,...(c?{c}:{}),...x});
const gs={v:1,bg:'#f5f9fc',maxW:400,layout:'right',lv:[{fs:20},{fs:16},{fs:14}],assets:{}};
const docs=[{format:'mymind/1',id:'kd',theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:N('d0','預設',[N('d1','甲',[N('d11','甲一')]),N('d2','乙',[N('d21','乙一')],{collapsed:true})])},
  {format:'mymind/1',id:'kc',theme:'classic',settings:{layout:'right'},icon:'🍑',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:N('c0','經典',[N('c1','甲',[N('c11','甲一')]),N('c2','乙',[N('c21','乙一')],{collapsed:true})],{gs})}];
const b=await chromium.launch({executablePath:exe}); const errs=[];
for(const mobile of [false,true]){ const T=mobile?'[phone] ':'[desktop] ';
  const ctx=await b.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1280,height:800}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.addInitScript(({docs})=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.clear(); localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'}));
    localStorage.setItem('mymind.index',JSON.stringify(docs.map(d=>({id:d.id,title:d.root.t,theme:d.theme,updated:d.updated})))); docs.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{docs});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  const tap=async(x,y)=>{ if(mobile) await p.touchscreen.tap(x,y); else await p.mouse.click(x,y); await W(350); };
  const xy=sel=>p.evaluate(s=>{ const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; },sel);
  const col=id=>p.evaluate(id=>{ const f=n=>n.id===id?n:(n.c||[]).map(f).find(Boolean); return !!f(window.__mm.doc.root).collapsed; },id);
  for(const [mid,P] of [['kd','d'],['kc','c']]){ const M=T+(P==='d'?'珊瑚: ':'經典蜜桃: ');
    await p.goto(BASE+'?nosw#/map/'+mid); await p.waitForSelector('body[data-ready="1"]'); await W(700);
    ok(M+'an unselected expanded node has no toggle (look unchanged)',!(await xy(`#mapsvg g.node[data-id="${P}1"] .cc`)));
    await tap(...await xy(`#mapsvg g.node[data-id="${P}1"] rect.hit`));
    const t=await xy(`#mapsvg g.node[data-id="${P}1"] .cc`); ok(M+'selecting it shows a − toggle',!!t);
    if(t){ await tap(...t); ok(M+'tapping − folds the branch',await col(P+'1')); }
    const bdg=await xy(`#mapsvg g.node[data-id="${P}1"] .cc`); if(bdg){ await tap(...bdg); ok(M+'tapping the count badge unfolds it',!(await col(P+'1'))); }
    if(mobile){ const bb=await xy('.nodetb [data-act="collapse"]'); ok(M+'node bar has 收合',!!bb); if(bb){ await tap(...bb); ok(M+'node bar 收合 folds',await col(P+'1')); await tap(...await xy('.nodetb [data-act="collapse"]')); ok(M+'node bar 展開 unfolds',!(await col(P+'1'))); } }
    else { await p.keyboard.press('Control+.'); await W(300); ok(M+'Ctrl+. folds',await col(P+'1')); await p.keyboard.press('Control+.'); await W(300); ok(M+'Ctrl+. unfolds',!(await col(P+'1'))); }
    const h=await xy(`#mapsvg g.node[data-id="${P}1"] .handle`); if(h){ await tap(...h); await W(200); const r=await p.evaluate(id=>{ const S=window.__mm, f=n=>n.id===id?n:(n.c||[]).map(f).find(Boolean); const n=f(S.doc.root); return {kids:n.c.length,ed:!!(S.editing&&S.editing.isNew),fold:!!n.collapsed}; },P+'1'); ok(M+'the + handle still adds a child (not the toggle)',r.kids===2&&r.ed&&!r.fold,JSON.stringify(r)); await p.keyboard.press('Escape'); await W(200); }
  }
  await ctx.close(); }
ok('no page errors',!errs.length,errs.join(' | ')); await b.close();
const n=res.filter(Boolean).length; console.log(`${n}/${res.length} passed`); process.exit(n===res.length?0:1);
