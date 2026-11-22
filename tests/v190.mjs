// v1.9: multi-select (Shift/Ctrl-click, 多選 mode on phones), quick styles on several nodes, 概要 summaries and 外框
// boundaries — every layout and the classic theme, undo, export, share viewer, outline, Markdown, merge. 
// Run: BASE=http://localhost:8765/ node tests/v190.mjs   (SHOTS=dir saves screenshots)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push([n,!!c]);console.log((c?'PASS ':'FAIL ')+n+(i&&!c?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const N=(id,t,c,x={})=>({id,t,...(c?{c}:{}),...x});
const tree=p=>N(p+'0','產品規劃',[N(p+'1','市場',[N(p+'11','競品分析'),N(p+'12','用戶訪談'),N(p+'13','定價')],{sm:[{id:p+'s1',a:p+'11',b:p+'13',t:'三週內完成',c:[N(p+'s11','負責：小林')]}]}),N(p+'2','設計'),N(p+'3','開發',[N(p+'31','前端'),N(p+'32','後端')]),N(p+'4','上線')],
  {sm:[{id:p+'s0',a:p+'2',b:p+'3',t:'Q1 重點',c:[N(p+'q1','設計稿'),N(p+'q2','原型'),N(p+'q3','可用性測試'),N(p+'q4','API'),N(p+'q5','部署')]}],bd:[{id:p+'b0',a:p+'3',b:p+'4',t:'工程團隊'}]});
const gs={v:1,bg:'#f5f9fc',maxW:400,layout:'right',lv:[{fs:20,fill:'#2f6fd0',color:'#ffffff',r:8},{fs:16,fill:'#e8f0fd',color:'#1f2329',r:6},{fs:14,color:'#1f2329'}],assets:{}};
const docs=[['r','coral',{}],['bl','coral',{layout:'balanced'}],['o','coral',{layout:'org'}],['c','classic',{layout:'right'}],['m','midnight',{}]].map(([id,theme,settings])=>({format:'mymind/1',id,theme,settings,icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:theme==='classic'?{...tree(id),gs}:tree(id)}));
const seed=async ctx=>{ await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.addInitScript(({docs})=>{ if(localStorage.getItem('v190.seeded')) return; localStorage.clear(); localStorage.setItem('v190.seeded','1'); localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'}));
    localStorage.setItem('mymind.index',JSON.stringify(docs.map(d=>({id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created})))); docs.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{docs}); };
const node=(p,id)=>p.evaluate(id=>{ const f=n=>n.id===id?n:[...(n.c||[]),...(n.sm||[])].map(f).find(Boolean); return JSON.parse(JSON.stringify(f(window.__mm.doc.root)||null)); },id);
// no two node boxes overlap (summary topics included); returns the offending pairs
const overlaps=p=>p.evaluate(()=>{ const bs=[...document.querySelectorAll('#mapsvg g.node')].map(g=>{ const r=(g.querySelector('[data-g="node"]')||g.querySelector('rect.hit')||g).getBoundingClientRect(); return {id:g.dataset.id,r}; }); const bad=[];
  for(let i=0;i<bs.length;i++) for(let j=i+1;j<bs.length;j++){ const a=bs[i].r,b=bs[j].r; if(a.left<b.right-2&&b.left<a.right-2&&a.top<b.bottom-2&&b.top<a.bottom-2) bad.push(bs[i].id+'×'+bs[j].id); } return bad; });
const b=await chromium.launch({executablePath:exe});
// ---------- desktop ----------
{ const ctx=await b.newContext({viewport:{width:1280,height:800},acceptDownloads:true}); await seed(ctx);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const open=async id=>{ await p.goto(BASE+'?nosw#/map/'+id); await p.waitForSelector('#mapsvg g.node'); await W(400); };
  const click=async(id,mod)=>{ await p.click(`#mapsvg g.node[data-id="${id}"]`,mod?{modifiers:[mod]}:{}); await W(150); };
  for(const [id,label] of [['r','向右'],['bl','左右'],['o','組織圖'],['c','經典蜜桃'],['m','深色']]){ await open(id);
    if(process.env.DBG) console.log(await p.evaluate(()=>[location.href,document.querySelectorAll('g.smg').length,JSON.stringify(window.__mm.doc.root).slice(0,300)]));
    const c=await p.evaluate(()=>[document.querySelectorAll('#mapsvg g.smg').length,document.querySelectorAll('#mapsvg g.bdg').length,document.querySelectorAll('#mapsvg .bdlbl').length]);
    ok(`${label}: 2 概要 brackets, 1 外框 with its label`,c[0]===2&&c[1]===1&&c[2]===1,JSON.stringify(c));
    const ov=await overlaps(p); ok(`${label}: no nodes overlap (summary topics have room)`,!ov.length,ov.join(' '));
    if(SHOTS) await p.screenshot({path:`${SHOTS}/v190-${id}.png`}); }
  for(const [id,label] of [['r','珊瑚'],['c','經典蜜桃']]){ const P=id; await open(id);
    // multi-select by Shift-click → bar → 概要
    await click(P+'31'); await click(P+'32','Shift');
    ok(`${label}: Shift-click selects two nodes and shows the bar`,await p.evaluate(()=>window.__mm.msel.length===2&&/2/.test(document.querySelector('.multibar .mbcount')?.textContent||'')));
    await p.click('.multibar [data-act="summary"]'); await W(300);
    const ed=await p.locator('#ovl .editbox').count(); await p.keyboard.press('Control+a'); await p.keyboard.type('Sprint 1'); await p.keyboard.press('Enter'); await W(200);
    const h=await node(p,P+'3'); ok(`${label}: 概要 over two siblings, editing its text right away`,ed===1&&h.sm&&h.sm.length===1&&h.sm[0].t==='Sprint 1'&&h.sm[0].a===P+'31'&&h.sm[0].b===P+'32',JSON.stringify(h.sm));
    ok(`${label}: the new bracket is drawn and nothing overlaps`,await p.locator('#mapsvg g.smg').count()===3&&!(await overlaps(p)).length,(await overlaps(p)).join(' '));
    await p.click('#cv',{position:{x:5,y:5}}).catch(()=>{}); await p.keyboard.press('Control+z'); await W(150); ok(`${label}: Ctrl+Z removes it`,!(await node(p,P+'3')).sm);
    await p.keyboard.press('Control+y'); await W(150); ok(`${label}: Ctrl+Y brings it back`,(await node(p,P+'3')).sm?.length===1);
    // 概要 topic behaves like a node: Tab adds a child, Enter explains, Delete removes the summary
    const sid=(await node(p,P+'3')).sm[0].id; await click(sid); await p.keyboard.press('Tab'); await W(200); await p.keyboard.type('任務'); await p.keyboard.press('Enter'); await W(200);
    ok(`${label}: Tab on a 概要 topic adds its child`,(await node(p,sid)).c?.[0]?.t==='任務');
    await click(sid); await p.keyboard.press('Enter'); await W(150); ok(`${label}: Enter on a 概要 topic explains there is no sibling`,/沒有同級/.test(await p.locator('#toast').textContent()));
    await p.keyboard.press('Delete'); await W(150); ok(`${label}: Delete removes the 概要`,!(await node(p,P+'3')).sm); await p.keyboard.press('Control+z'); await W(150);
    // non-adjacent → clear reason
    await click(P+'11'); await click(P+'13','Control'); await p.click('.multibar [data-act="boundary"]',{force:true}); await W(150);
    ok(`${label}: 外框 on non-adjacent nodes explains why not`,/相鄰/.test(await p.locator('#toast').textContent())&&!(await node(p,P+'1')).bd);
    await p.keyboard.press('Escape'); await W(100); ok(`${label}: Esc leaves multi-select`,await p.evaluate(()=>!window.__mm.msel.length&&!document.querySelector('.multibar')));
    // Ctrl+B 外框 on one node, label from the toast, colour + remove from its menu
    await click(P+'2'); await p.keyboard.press('Control+b'); await W(200); ok(`${label}: Ctrl+B puts a 外框 around the node`,(await node(p,P+'0')).bd?.length===2);
    await p.click('#toast [data-act="bdLabel"]'); await W(200); await p.fill('#pr-in','設計組'); await p.click('[data-act="promptOk"]'); await W(200);
    ok(`${label}: 外框 label`,await p.evaluate(()=>[...document.querySelectorAll('#mapsvg .bdlbl text')].some(t=>t.textContent==='設計組')));
    await p.locator('#mapsvg .bdlbl',{hasText:'設計組'}).click(); await W(200); ok(`${label}: tapping the label opens the 外框 menu`,await p.locator('#layer .bdmenu').count()===1);
    await p.click('#layer .bdmenu [data-act="bdColor"][data-v$="#2F9E44"]'); await W(150); const bd=(await node(p,P+'0')).bd.find(x=>x.t==='設計組'); ok(`${label}: 外框 colour`,bd&&bd.col==='#2F9E44');
    await p.locator('#mapsvg .bdlbl',{hasText:'設計組'}).click(); await W(200); await p.click('#layer .bdmenu [data-act="bdDel"]'); await W(150); ok(`${label}: 移除外框`,(await node(p,P+'0')).bd.length===1);
    // quick style + delete on several nodes
    await click(P+'2'); await click(P+'4','Control'); await p.click('.multibar [data-act="quickStyle"]'); await W(200); await p.click('#layer .qsmenu [data-act="qs"][data-v="key"]'); await W(150);
    ok(`${label}: 快速樣式 applies to every selected node`,(await node(p,P+'2')).qs==='key'&&(await node(p,P+'4')).qs==='key');
    if(SHOTS) await p.screenshot({path:`${SHOTS}/v190-desktop-multi-${id}.png`});
    await p.click('.multibar [data-act="multiDel"]'); await W(150); ok(`${label}: 刪除 removes both`,!(await node(p,P+'2'))&&!(await node(p,P+'4')));
    await p.keyboard.press('Control+z'); await W(150); ok(`${label}: and Ctrl+Z restores both`,!!(await node(p,P+'2'))&&!!(await node(p,P+'4')));
    // export + viewer
    await p.click('[data-act="exportMenu"]'); const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#layer [data-act="exp"][data-v="svg"]')]); const svg=fs.readFileSync(await dl.path(),'utf8');
    ok(`${label}: SVG export has brackets and the boundary`,(svg.match(/class="smg"/g)||[]).length>=2&&/class="bdg"/.test(svg)&&/Q1 重點/.test(svg));
    await p.click('[data-act="exportMenu"]'); const [dp]=await Promise.all([p.waitForEvent('download'),p.click('#layer [data-act="exp"][data-v="png"]')]); ok(`${label}: PNG export works`,fs.statSync(await dp.path()).size>3000);
    const link=await p.evaluate(async()=>{ const SH=await import('./js/share.js'); return SH.inlineLink(location.href.split('#')[0],await SH.seal(SH.snapshot(window.__mm.doc))); });
    const v=await ctx.newPage(); await v.goto(link); await v.waitForFunction(()=>document.body.dataset.ready==='1');
    ok(`${label}: share viewer draws 概要 and 外框`,await v.evaluate(()=>document.querySelectorAll('#mapsvg g.smg').length>=2&&document.querySelectorAll('#mapsvg g.bdg').length>=1&&/Q1 重點/.test(document.querySelector('#mapsvg').textContent))); await v.close();
  }
  // outline + Markdown + merge (coral map)
  await open('r');
  const md=await p.evaluate(async()=>{ const IO=await import('./js/io.js'); return IO.toMarkdown(window.__mm.doc.root); });
  ok('Markdown: 〔概要〕 after its range, 外框 noted on its first node',/- 〔概要〕Q1 重點/.test(md)&&/  - 〔概要〕三週內完成/.test(md)&&/開發（外框：工程團隊，2 項）/.test(md)&&md.indexOf('〔概要〕Q1 重點')>md.indexOf('後端'),md);
  await p.click('[data-act="outline"]'); await W(500);
  ok('outline: 概要 rows and 外框 chips',await p.evaluate(()=>document.querySelectorAll('#outlineHost .olchip.sum').length>=2&&[...document.querySelectorAll('#outlineHost .olchip')].some(e=>/外框：工程團隊/.test(e.textContent))&&!!document.querySelector('#outlineHost .olin[value="Q1 重點"]')));
  await p.click('[data-act="outline"]'); await W(300);
  const mg=await p.evaluate(async()=>{ const M=await import('./js/merge.js'); const base={root:{id:'r',t:'根',c:[{id:'a',t:'甲'},{id:'b',t:'乙'}]}}; const mine={root:{id:'r',t:'根',c:[{id:'a',t:'甲'},{id:'b',t:'乙'}],sm:[{id:'s',a:'a',b:'b',t:'小結'}],bd:[{id:'x',a:'a',b:'a'}]}}; const theirs={root:{id:'r',t:'根',c:[{id:'a',t:'甲改',qs:'done'},{id:'b',t:'乙'}]}};
    const r=M.merge3(base,mine,theirs).doc.root; return {sm:r.sm&&r.sm[0].t,bd:r.bd&&r.bd.length,t:r.c[0].t,qs:r.c[0].qs}; });
  ok('sync merge keeps 概要, 外框 and quick styles from both sides',mg.sm==='小結'&&mg.bd===1&&mg.t==='甲改'&&mg.qs==='done',JSON.stringify(mg));
  const stored=await p.evaluate(()=>window.__mmStore.maps.load('r').root); ok('saved map (sync/backup payload) carries sm and bd',Array.isArray(stored.sm)&&Array.isArray(stored.bd));
  ok('desktop: no page errors',!errs.length,errs.join(' | ')); await ctx.close(); }
// ---------- phone ----------
{ const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}); await seed(ctx);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>{errs.push(e.message); if(process.env.DBG) console.log(e.stack);}); const cdp=await ctx.newCDPSession(p);
  const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y],i)=>({x,y,id:i}))});
  const vis=sel=>p.evaluate(s=>{ const e=[...document.querySelectorAll(s)].find(e=>{ const r=e.getBoundingClientRect(); return r.width>0&&r.height>0; }); if(!e) return null; const r=e.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2,r.width,r.height]; },sel);
  const tap=async sel=>{ const xy=await vis(sel); if(!xy) throw new Error('not visible '+sel); await p.touchscreen.tap(xy[0],xy[1]); await W(380); };
  const lp=async id=>{ const xy=await vis(`#mapsvg g.node[data-id="${id}"] [data-g="node"], #mapsvg g.node[data-id="${id}"]`); await touch('touchStart',[[xy[0],xy[1]]]); await W(750); await touch('touchEnd',[]); await W(400); };
  for(const [id,label] of [['r','珊瑚'],['c','經典蜜桃']]){ const P=id;
    await p.goto(BASE+'?nosw#/map/'+id); await p.waitForSelector('#mapsvg g.node'); await W(600);
    await p.evaluate(()=>document.querySelector('[data-act="fit"]')?.click()); await W(300);
    await lp(P+'31'); ok(`phone ${label}: node menu has 多選, 概要, 外框`,!!await vis('#layer [data-act="multiStart"]')&&!!await vis('#layer [data-act="summary"]')&&!!await vis('#layer [data-act="boundary"]'));
    await tap('#layer [data-act="multiStart"]'); ok(`phone ${label}: 多選 shows the bar (1 selected), no node bar`,!!await vis('.multibar')&&!await vis('.nodetb')&&/1/.test(await p.locator('.multibar .mbcount').textContent()));
    await tap(`#mapsvg g.node[data-id="${P}32"]`); ok(`phone ${label}: tapping another node adds it`,await p.evaluate(()=>window.__mm.msel.length===2));
    const bar=await p.$$eval('.multibar .btn',e=>e.map(x=>{ const r=x.getBoundingClientRect(); return [Math.round(r.width),Math.round(r.height),r.left>=0&&r.right<=innerWidth]; }));
    ok(`phone ${label}: bar fits 390px with ≥44px buttons`,bar.length>=5&&bar.every(x=>x[0]>=44&&x[1]>=44&&x[2]),JSON.stringify(bar));
    if(SHOTS) await p.screenshot({path:`${SHOTS}/v190-phone-multi-${id}.png`});
    await tap('.multibar [data-act="boundary"]'); ok(`phone ${label}: 外框 from the bar`,(await node(p,P+'3')).bd?.length===1&&!await vis('.multibar'));
    await lp(P+'2'); await tap('#layer [data-act="summary"]'); await W(200); const ed=!!await vis('#ovl .editbox'); if(process.env.DBG) console.log('after summary',JSON.stringify((await node(p,P+'0')).sm.map(x=>[x.id,x.a,x.b,x.t])),await p.evaluate(()=>JSON.stringify(window.__mm.editing))); await p.keyboard.type('X'); if(process.env.DBG) console.log('at',await p.evaluate(()=>{ const r=document.querySelector('#mapsvg').getBoundingClientRect(); const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return e.outerHTML.slice(0,150)+' | '+(e.closest('g')?.outerHTML.slice(0,120)); })); if(process.env.DBG) console.log('typed',await p.evaluate(()=>JSON.stringify([window.__mm.editing,window.__mm.sel]))); await p.touchscreen.tap(30,700); await W(500);
    ok(`phone ${label}: 概要 on one node from the node menu opens the editor`,ed&&(await node(p,P+'0')).sm.length===2);
    ok(`phone ${label}: nothing overlaps after adding`,!(await overlaps(p)).length,(await overlaps(p)).join(' '));
    if(process.env.DBG) console.log('lbl',await p.evaluate(()=>[...document.querySelectorAll('#mapsvg .bdlbl')].map(e=>{ const r=e.getBoundingClientRect(); const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return [Math.round(r.x),Math.round(r.y),Math.round(r.width),h&&h.outerHTML.slice(0,80)]; })));
    await tap(`#mapsvg .bdlbl`); if(process.env.DBG) console.log('menu',await p.evaluate(()=>document.querySelector('#layer')?.innerHTML.slice(0,200))); const sw=await p.$$eval('#layer .bdmenu .bdc',e=>e.map(x=>Math.round(x.getBoundingClientRect().width)));
    ok(`phone ${label}: tapping a 外框 label opens its menu with 44px colour targets`,sw.length>=7&&sw.every(w=>w>=44),JSON.stringify(sw));
    if(SHOTS) await p.screenshot({path:`${SHOTS}/v190-phone-bdmenu-${id}.png`});
    await p.evaluate(()=>document.querySelector('#layer .menuscrim')?.click()); await W(200);
    if(SHOTS){ await p.evaluate(()=>document.querySelector('[data-act="fit"]')?.click()); await W(300); await p.screenshot({path:`${SHOTS}/v190-phone-${id}.png`}); }
  }
  ok('phone: no page errors',!errs.length,errs.join(' | ')); await ctx.close(); }
await b.close(); const pass=res.filter(r=>r[1]).length; console.log(`${pass}/${res.length} passed`); process.exit(pass===res.length?0:1);
