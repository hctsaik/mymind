// 經典蜜桃 (classic engine) checks: box metrics, margins and gaps, the children-anchor rule, fork-rounded connectors,
// multi-line text, stickers, priority badges, drag offsets, collapse, app integration, and that no other theme changed.
// Run: BASE=http://localhost:8765/ node tests/classic.mjs   (SHOTS=dir saves screenshots)
import { chromium } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
let k=0; const N=(t,c,x={})=>({id:'c'+(++k),t,...x,...(c?{c}:{})});
const root=N('中心主題\n第二行',[
  N('甲',[N('一'),N('二',[N('子')]),N('三')]),
  N('乙 ',[N('多行\n第二行\n第三行'),N('圖示',null,{icon:'💡'}),N('優先',null,{pri:2})]),
  N('丙',[N('a'),N('b'),N('c'),N('d')]),
  N('丁',[N('位移',[N('x')],{off:{x:1,y:7}}),N('其他',[N('y')])]),
  N('收合',[N('藏起來')],{collapsed:true}),
  N('戊',[N('寬',null,{shape:'arc'})])]);
const doc={format:'mymind/1',id:'cl1',theme:'classic',settings:{layout:'right'},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root};
const b=await chromium.launch({executablePath:exe});
{ const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'tests/classic-render.html'); await p.waitForFunction(()=>window.ready); await p.evaluate(()=>window.fontsReady('中心主題第二行甲乙丙丁一二三子多行圖示優先位移其他收合藏起來戊寬abcdxy'));
  const r=await p.evaluate(d=>{ const o=window.renderDoc(d,160,400,1); const svg=document.getElementById('vp').innerHTML; return {...o,svg}; },doc);
  const by=Object.fromEntries(r.nodes.map(n=>[n.t,n])), L=n=>n.x-n.w/2, R=n=>n.x+n.w/2, T=n=>n.y-n.h/2, B=n=>n.y+n.h/2, near=(a,b,e=.02)=>Math.abs(a-b)<=e;
  ok('root is an arc-sided pill: height = 2 lines × 31.1875 + 32',near(by['中心主題\n第二行'].h,94.375),by['中心主題\n第二行'].h);
  ok('level-1 box: one line 16px → 39.1875 tall; 1-char text uses the 17px minimum + 2×15 padding',near(by['甲'].h,39.1875)&&near(by['甲'].w,47),by['甲'].w+'×'+by['甲'].h);
  ok('deeper node: 14px → 29 tall (17px minimum content), single-character node 35 wide',near(by['一'].h,29)&&near(by['一'].w,35),by['一'].w+'×'+by['一'].h);
  ok('three explicit lines all kept (no 2-line cap): 3 × 16.797 + 12',near(by['多行\n第二行\n第三行'].h,62.39,.01),by['多行\n第二行\n第三行'].h);
  ok('icon node: 21px sticker + 6px gap, 33 tall',near(by['圖示'].h,33)&&near(by['圖示'].w,28+18+27,0.3),by['圖示'].w+'×'+by['圖示'].h);
  ok('priority node: 17px badge + 5px gap',near(by['優先'].w,28+18+22,0.3)&&near(by['優先'].h,29),by['優先'].w);
  ok('trailing space does not widen the box (shown like HTML text)',near(by['乙 '].w,by['甲'].w,.5),by['乙 '].w+' vs '+by['甲'].w);
  ok('horizontal gaps: root→L1 51, L1→L2 31, deeper 26',near(L(by['甲'])-R(by['中心主題\n第二行']),51,.05)&&near(L(by['一'])-R(by['甲']),31,.05)&&near(L(by['子'])-R(by['二']),26,.05));
  ok('sibling gaps: leaf/leaf 20, with children 24, level-1 34',near(T(by['b'])-B(by['a']),20,.05)&&near(T(by['二'])-B(by['一']),24,.05)&&near(by['乙 '].y-by['甲'].y>0?1:0,1));
  ok('parent centred on first/last child (2 children)',near(by['丁'].y,(by['位移'].y-7+by['其他'].y)/2,.05));
  ok('4 children: anchor snaps to the middle pair within 12px',near(by['丙'].y,(by['b'].y+by['c'].y)/2,.05));
  ok('drag offset {x:1,y:7} moves only that branch, after centring',near(L(by['位移'])-R(by['丁']),32,.05)&&near(T(by['位移'])+0,T(by['位移'])));
  ok('arc-shaped node is wider by H/2 − padY/2',near(by['寬'].w,35+29/2-3,.05),by['寬'].w);
  ok('collapsed children are not laid out on screen',!r.nodes.some(n=>n.t==='藏起來'));
  ok('connectors: stub, spine, smoothed elbow (C), into the child left edge',/M[\d.]+ [-\d.]+ L[\d.]+ [-\d.]+ L[\d.]+ [-\d.]+ C[\d. -]+ L[\d.]+ [-\d.]+/.test(r.svg)&&/stroke="#FF8E6E" stroke-width="2"/.test(r.svg));
  ok('level-1 box white with #FFBB91 2px border; root filled #FFBB91',/fill="#FFFFFF" stroke="#FFBB91" stroke-width="2"/.test(r.svg)&&/fill="#FFBB91" stroke="none"/.test(r.svg));
  ok('sticker and badge drawn (own vector art, no external images)',/data-g="icon" transform/.test(r.svg)&&/<circle cx="[\d.]+" cy="[-\d.]+" r="8" fill="#f9b62a"/.test(r.svg)&&!/<image/.test(r.svg));
  ok('no NaN anywhere',!/NaN/.test(r.svg)); ok('no page errors',!errs.length,errs.join(' | '));
  if(SHOTS) await p.screenshot({path:SHOTS+'/classic-harness.png'}); await p.context().close(); }
// in the app: theme picker card, switching themes, editing keeps the engine, other themes unchanged
{ const ctx=await b.newContext({viewport:{width:1440,height:900}}); await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.addInitScript(d=>{ if(sessionStorage.s) return; sessionStorage.s=1; localStorage.clear(); localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'})); localStorage.setItem('mymind.index',JSON.stringify([{id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created}])); localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d)); },doc);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'?nosw#/map/cl1'); await p.waitForSelector('body[data-ready="1"]'); await W(900);
  const st=await p.evaluate(()=>({n:document.querySelectorAll('#mapsvg g.node').length, cv:getComputedStyle(document.querySelector('#cv')).getPropertyValue('--cv').trim(), pct:document.querySelector('#pct')&&document.querySelector('#pct').textContent}));
  ok('app renders the classic map (all visible nodes, peach canvas, opens at 100%)',st.n===23&&st.cv==='#FFF1E6'&&st.pct==='100%',JSON.stringify(st));
  if(SHOTS) await p.screenshot({path:SHOTS+'/classic-app.png'});
  await p.evaluate(()=>{ const e=[...document.querySelectorAll('[data-act="style"]')].find(e=>e.offsetParent); e&&e.click(); }); await W(300);
  ok('theme picker lists 經典蜜桃',await p.evaluate(()=>!!document.querySelector('[data-act="theme"][data-v="classic"]')&&/經典蜜桃/.test(document.querySelector('[data-act="theme"][data-v="classic"]').textContent)));
  await p.click('[data-act="theme"][data-v="coral"]'); await W(300);
  ok('switching to 珊瑚 uses the default renderer again',await p.evaluate(()=>window.__mm.doc.theme==='coral'&&!document.querySelector('#mapsvg path[d*=" A"]')));
  await p.click('[data-act="theme"][data-v="classic"]'); await W(300);
  ok('and back to 經典蜜桃',await p.evaluate(()=>window.__mm.doc.theme==='classic'&&document.querySelectorAll('#mapsvg g.node').length===23));
  ok('app: no page errors',!errs.length,errs.join(' | ')); await ctx.close(); }
await b.close();
const n=res.filter(Boolean).length; console.log(`${n}/${res.length} passed`); process.exit(n===res.length?0:1);
