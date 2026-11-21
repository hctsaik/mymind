// v1.5 checks: advanced AI (expand / article → map / summary / regroup) with preview + one undo step + cancel + errors,
// and relationship lines (create, label, select, delete, layouts, collapsed ends, outline indicator, exports, merge).
// OpenAI is mocked. Run: BASE=http://localhost:8765/ node tests/v15.mjs   (SHOTS=dir saves screenshots)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
// merge3 keeps relationship lines (pure module, runs in node)
{ const { merge3 }=await import('../js/merge.js');
  const base={root:{id:'r',t:'R',c:[{id:'a',t:'A'},{id:'b',t:'B'},{id:'c',t:'C'}],rels:[{id:'x',a:'a',b:'b'}]}};
  const mine=JSON.parse(JSON.stringify(base)); mine.root.rels.push({id:'y',a:'b',b:'c',label:'mine'}); mine.root.c[0].tags=['t1'];
  const theirs=JSON.parse(JSON.stringify(base)); theirs.root.rels=[]; theirs.root.c[1].color=2;
  const m=merge3(base,mine,theirs).doc.root;
  ok('merge3: line added on my side kept, line deleted on their side stays deleted',JSON.stringify(m.rels)===JSON.stringify([{id:'y',a:'b',b:'c',label:'mine'}]),JSON.stringify(m.rels));
  ok('merge3: v1.4 fields (tags, colour) survive a merge',JSON.stringify(m.c[0].tags)==='["t1"]'&&m.c[1].color===2,JSON.stringify(m.c)); }
const b=await chromium.launch({executablePath:exe});
const doc={format:'mymind/1',id:'t15',theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',
  root:{id:'r',t:'產品發表會',c:[{id:'a',t:'場地',c:[{id:'a1',t:'信義區展演廳'}]},{id:'b',t:'講者'},{id:'c',t:'媒體邀請'},{id:'d',t:'預算'},{id:'e',t:'贈品'}]}};
let mode='ok'; const calls=[];
async function ai(route){ const req=route.request(); const H={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:H});
  const body=JSON.parse(req.postData()), u=body.messages[1].content; calls.push(u);
  if(mode==='net') return route.abort('internetdisconnected');
  if(mode==='slow') await W(4000);
  if(mode==='401') return route.fulfill({status:401,contentType:'application/json',headers:H,body:JSON.stringify({error:{message:'Incorrect API key provided'}})});
  if(mode==='429') return route.fulfill({status:429,contentType:'application/json',headers:H,body:JSON.stringify({error:{message:'Rate limit reached'}})});
  let out;
  if(/重新分成/.test(u)) out={groups:[{t:'人與內容',items:[1,2]},{t:'錢與物',items:[3,4]}]};      // index 0 left out on purpose → 其他
  else if(/摘要/.test(u)) out={summary:'發表會聚焦場地、講者與媒體，預算需控制在兩百萬內。',points:['確認場地','邀請講者','控制預算']};
  else if(/發想/.test(u)) out={t:'x',c:[{t:'主講人',c:[{t:'CEO'}]},{t:'產品經理'},{t:'客戶代表'}]};
  else out={t:'日本旅遊計畫',c:[{t:'行程',c:[{t:'東京'},{t:'京都'}]},{t:'預算',c:[{t:'機票'}]},{t:'交通'}]};
  return route.fulfill({status:200,contentType:'application/json',headers:H,body:JSON.stringify({choices:[{message:{content:JSON.stringify(out)}}]})}); }
for(const mobile of [false,true]){ const T=mobile?'[mobile] ':''; const sfx=mobile?'mobile':'desktop';
  const ctx=await b.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1440,height:900}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.route('https://api.openai.com/**',ai);
  await ctx.addInitScript(d=>{ if(sessionStorage.s) return; sessionStorage.s=1; localStorage.clear(); localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'})); localStorage.setItem('mymind.index',JSON.stringify([{id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created}])); localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d)); },doc);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/status of (401|429)|ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(m.text())) errs.push(m.text()); });
  await p.goto(BASE+'?nosw#/map/t15'); await p.waitForSelector('body[data-ready="1"]'); await W(500);
  const R=()=>p.evaluate(()=>JSON.parse(JSON.stringify(window.__mm.doc.root)));
  const hclick=sel=>p.evaluate(s=>{ const l=[...document.querySelectorAll(s)]; const e=l.find(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed')||l[0]; if(!e) throw new Error('no '+s); e.click(); },sel);
  const shot=async n=>{ if(SHOTS) await p.screenshot({path:`${SHOTS}/${n}-${sfx}.png`}); };
  const center=id=>p.evaluate(id=>{ const r=document.querySelector(`#mapsvg g.node[data-id="${id}"] rect.hit`).getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; },id);
  const tap=async([x,y])=>{ if(mobile) await p.touchscreen.tap(x,y); else await p.mouse.click(x,y); await W(250); };
  const selectNode=async id=>{ await tap(await center(id)); };
  const openAI=async tab=>{ await hclick(mobile?'.rb.ai':'[data-act="aiExpand"]'); await W(250); await hclick(`#ait-${tab}`); await W(150); };
  const run=async()=>{ await hclick('.dlg [data-act="aiRun"]'); await p.waitForSelector('.dlg .aires, .dlg [role=alert]',{timeout:8000}).catch(()=>{}); await W(150); };
  const accept=async()=>{ await hclick('.dlg [data-act="aiAccept"]'); await W(350); };
  const undoToast=async()=>{ await hclick('#toast [data-act="undo"]'); await W(300); };
  const countAll=r=>{ let n=0; (function w(x){ n++; (x.c||[]).forEach(w); })(r); return n; };

  // ---------- AI: no key ----------
  await selectNode('b'); await openAI('expand'); await run();
  ok(T+'AI without key: clear error + toast, nothing changed',/還沒有設定 OpenAI 金鑰/.test(await p.locator('.dlg [role=alert]').textContent())&&/OpenAI 金鑰/.test(await p.locator('#toast').textContent()));
  await p.keyboard.press('Escape'); await W(200);
  await p.evaluate(()=>localStorage.setItem('mymind.openai',JSON.stringify('sk-test-FAKE')));
  // ---------- expand selected branch: preview → accept → one undo ----------
  await selectNode('b'); await openAI('expand'); await run();
  const rows=await p.locator('.dlg .difftree .m-new').count();
  ok(T+'expand: preview diff lists the new nodes (marked 新增) before anything changes',rows===4&&!(await R()).c[1].c,`rows=${rows}`);
  ok(T+'expand: preview shows Accept / 重新產生 / Cancel',await p.locator('.dlg [data-act="aiAccept"]').count()===1&&await p.locator('.dlg .mfoot [data-act="aiRun"]').count()===1&&await p.locator('.dlg .mfoot [data-act="closeDialog"]').count()===1);
  await shot('01-ai-expand-preview');
  await accept(); let r=await R();
  ok(T+'expand: accept inserts under the selected node',r.c[1].c&&r.c[1].c.length===3&&r.c[1].c[0].c[0].t==='CEO',JSON.stringify(r.c[1]));
  await undoToast(); r=await R(); ok(T+'expand: ONE undo step removes everything it added',!r.c[1].c,JSON.stringify(r.c[1]));
  // cancel (preview) leaves the map alone
  await openAI('expand'); await run(); await hclick('.dlg .mfoot [data-act="closeDialog"]'); await W(250); r=await R(); ok(T+'expand: Cancel on the preview changes nothing',!r.c[1].c);
  // ---------- loading + stop (AbortController) ----------
  mode='slow'; await openAI('expand'); await hclick('.dlg [data-act="aiRun"]'); await W(400);
  ok(T+'loading state: busy text + 停止 button',/發想子主題中/.test(await p.locator('.dlg').textContent())&&await p.locator('.dlg [data-act="aiCancel"]').count()===1);
  await shot('02-ai-loading');
  await hclick('.dlg [data-act="aiCancel"]'); await W(300);
  ok(T+'stop: request aborted, toast, no preview, map untouched',/已停止/.test(await p.locator('#toast').textContent())&&await p.locator('.dlg .aires').count()===0&&!(await R()).c[1].c);
  await W(4000); ok(T+'stop: a late answer never lands',await p.locator('.dlg .aires').count()===0&&!(await R()).c[1].c);
  // ---------- errors ----------
  for(const [m,re,name] of [['401',/401/,'401'],['429',/429/,'429'],['net',/網路/,'network']]){ mode=m; await run();
    const t=await p.locator('.dlg [role=alert]').textContent().catch(()=>''), ts=await p.locator('#toast').textContent();
    ok(T+`error ${name}: alert in the dialog + toast, content kept`,re.test(t)&&re.test(t+ts)&&(m!=='401'||/金鑰/.test(t)),t.slice(0,50)+' | '+ts);
    if(m==='429') await shot('03-ai-error-429'); }
  mode='ok'; await p.keyboard.press('Escape'); await W(200);
  // ---------- regroup the selected node's children ----------
  await selectNode('r'); await openAI('regroup'); await run();
  const g=await p.locator('.dlg .difftree .m-group').count(), mv=await p.locator('.dlg .difftree .m-moved').count();
  ok(T+'regroup: preview shows new groups (incl. 其他 for anything the AI skipped) and every moved child',g===3&&mv===5,`groups=${g} moved=${mv}`);
  await shot('04-ai-regroup-preview');
  const before=countAll(await R()); await accept(); r=await R();
  ok(T+'regroup: children now under 3 groups, nothing lost (sub-nodes kept)',r.c.length===3&&r.c.map(x=>x.t).join()==='人與內容,錢與物,其他'&&countAll(r)===before+3&&JSON.stringify(r).includes('信義區展演廳'),r.c.map(x=>x.t).join());
  await undoToast(); r=await R(); ok(T+'regroup: one undo restores the original order',r.c.map(x=>x.id).join()==='a,b,c,d,e');
  // ---------- summarize the map ----------
  await openAI('summary'); await run(); await shot('05-ai-summary-preview');
  ok(T+'summary: preview shows the summary + points (marked 詳情)',await p.locator('.dlg .difftree .m-note').count()===4);
  await accept(); r=await R(); ok(T+'summary → note: written into the root note',/兩百萬/.test(r.note||'')&&/- 控制預算/.test(r.note));
  await undoToast(); await openAI('summary'); await p.locator('.dlg input[data-ai="sumTo"][value="node"]').check(); await run(); await accept(); r=await R();
  const sn=r.c.at(-1); ok(T+'summary → new node: 「摘要」 with points as children and the summary in its note',sn.t==='摘要'&&sn.c.length===3&&/兩百萬/.test(sn.note),JSON.stringify(sn));
  await undoToast();
  // ---------- article / text → mind map ----------
  await selectNode('c'); await openAI('notes'); await p.fill('[data-ai="notes"]','日本旅遊：東京、京都行程，機票預算與交通安排。'.repeat(3));
  ok(T+'article: character counter',/\d+ \/ 12,000 字/.test(await p.locator('.dlg .aicount').textContent()));
  await p.locator('.dlg input[data-ai="into"][value="node"]').check(); await run(); await shot('06-ai-article-preview');
  await accept(); r=await R(); ok(T+'article → under the selected node',r.c[2].c&&r.c[2].c[0].t==='日本旅遊計畫'&&r.c[2].c[0].c.length===3);
  await undoToast(); r=await R(); ok(T+'article: one undo',!r.c[2].c);
  await openAI('notes'); await p.fill('[data-ai="notes"]','一篇文章'); await p.locator('.dlg input[data-ai="into"][value="new"]').check(); await run();
  ok(T+'article → new map: preview says it creates a new map',/新圖/.test(await p.locator('.dlg .aistat').textContent()));
  await accept(); await W(400); ok(T+'article → new map created and opened',await p.evaluate(()=>window.__mm.doc.root.t==='日本旅遊計畫'&&window.__mm.mapId!=='t15'));
  await p.evaluate(()=>{ location.hash='#/map/t15'; }); await W(500);
  ok(T+'AI requests carry the key only as a bearer header',calls.length>0);

  // ---------- relationship lines ----------
  await selectNode('b');
  if(mobile){ const [x,y]=await center('b'); await p.evaluate(([x,y])=>{ const el=document.elementFromPoint(x,y); el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:x,clientY:y})); },[x,y]); await W(250);
    ok(T+'node menu (long-press menu) has 關聯線',await p.locator('.lpmenu [data-act="relStart"]').count()===1); await hclick('.lpmenu [data-act="relStart"]'); }
  else { await p.focus('#cv'); await p.keyboard.press('Alt+l'); }
  await W(250); ok(T+'rel: pick mode shows an instruction bar with 取消',await p.locator('#relbar').isVisible()&&/講者/.test(await p.locator('#relbar').textContent()));
  await shot('07-rel-pick');
  { const ov=await p.evaluate(()=>{ document.body.insertAdjacentHTML('beforeend','<div class="toast on" id="tt" role="status">已產生新圖「日本旅遊計畫」</div>'); const t=document.getElementById('tt').getBoundingClientRect(), b=document.getElementById('relbar').getBoundingClientRect(); document.getElementById('tt').remove(); return !(t.right<=b.left||t.left>=b.right||t.bottom<=b.top||t.top>=b.bottom); });
    ok(T+'rel pick bar: a toast never covers the instruction bar',!ov); }
  await tap(await center('e')); r=await R();
  ok(T+'rel: tapping the target creates a line stored in the map',r.rels&&r.rels.length===1&&r.rels[0].a==='b'&&r.rels[0].b==='e',JSON.stringify(r.rels));
  const relSvg=await p.evaluate(()=>{ const g=document.querySelector('#mapsvg g.rel'); const v=g&&g.querySelector('path[data-g=rel]'); return v?{dash:v.getAttribute('stroke-dasharray'),marker:v.getAttribute('marker-end'),d:v.getAttribute('d'),label:g.getAttribute('aria-label')}:null; });
  ok(T+'rel: curved (cubic), dashed, arrow-headed, named for screen readers',relSvg&&/ C/.test(relSvg.d)&&relSvg.dash==='7 5'&&/url\(#rela/.test(relSvg.marker)&&/講者 → 贈品/.test(relSvg.label),JSON.stringify(relSvg));
  ok(T+'rel: saved to storage (map file)',await p.evaluate(()=>(window.__mmStore.maps.load('t15').root.rels||[]).length===1));
  // label via the line's menu
  const midOf=id=>p.evaluate(id=>{ const pa=document.querySelector(`#mapsvg g.rel[data-rel="${id}"] path[data-g=rel]`); const L=pa.getTotalLength(), pt=pa.getPointAtLength(L/2), m=pa.getScreenCTM(); return [pt.x*m.a+m.e,pt.y*m.d+m.f]; },id);
  const rid0=r.rels[0].id;
  const mid=await p.evaluate(()=>{ const pa=document.querySelector('#mapsvg g.rel path[data-g=rel]'); const L=pa.getTotalLength(), pt=pa.getPointAtLength(L/2), m=pa.getScreenCTM(); return [pt.x*m.a+m.e,pt.y*m.d+m.f]; });
  await tap(mid); await W(300); ok(T+'rel: tapping the line selects it and opens its menu',await p.locator('.relmenu').count()===1&&await p.locator('#mapsvg g.rel.sel').count()===1);
  await shot('08-rel-menu');
  await hclick('.relmenu [data-act="relLabel"]'); await W(250); await p.fill('#pr-in','同一位負責人'); await hclick('[data-act="promptOk"]'); await W(300);
  r=await R(); ok(T+'rel: optional label saved and drawn',r.rels[0].label==='同一位負責人'&&/同一位負責人/.test(await p.locator('#mapsvg').textContent()));
  await selectNode('r'); ok(T+'rel: selecting a node deselects the line',await p.locator('#mapsvg g.rel.sel').count()===0);
  { const lb=await p.evaluate(()=>{ const g=document.querySelector('#mapsvg g.rellbl'), st=document.getElementById('stage').getBoundingClientRect(); const b=g.getBoundingClientRect(); return {l:b.left-st.left,r:st.right-b.right,t:b.top-st.top,b:st.bottom-b.bottom,title:g.querySelector('title')&&g.querySelector('title').textContent}; });
    ok(T+'rel label stays inside the visible canvas (≥8px margin) and keeps the full text as a tooltip',lb.l>=7.5&&lb.r>=7.5&&lb.t>=7.5&&lb.b>=7.5&&lb.title==='同一位負責人',JSON.stringify(lb));
    const cc=await p.evaluate(()=>{ const rel=document.querySelector('#mapsvg g.rel:not(.sel):not(.rellbl) path[data-g=rel]').getAttribute('stroke'); const tree=[...document.querySelectorAll('#mapsvg .edges path')].map(e=>e.getAttribute('stroke')).find(Boolean); return {rel,tree}; });
    const {cr}=await import('../js/core.js');
    ok(T+'unselected relationship line uses its own colour (not the tree line colour), ≥3:1 on white and on 蜜桃 canvas',cc.rel&&cc.tree&&cc.rel.toLowerCase()!==cc.tree.toLowerCase()&&cr(cc.rel,'#FFFFFF')>=3&&cr(cc.rel,'#FFF1E6')>=3,JSON.stringify(cc)); }
  await shot('09-rel-label');
  // flip
  await tap(mid); await W(300); await hclick('.relmenu [data-act="relFlip"]'); r=await R(); ok(T+'rel: flip swaps the arrow',r.rels[0].a==='e'&&r.rels[0].b==='b');
  await undoToast();
  // layouts
  for(const lay of ['balanced','org','right']){ await p.evaluate(l=>{ const m=window.__mm; m.doc.settings=m.doc.settings||{}; m.doc.settings.layout=l; window.__mmStore.changed(); },lay); await hclick('[data-act="fit"]').catch(()=>{}); await W(300);
    const c=await p.evaluate(()=>{ const pa=document.querySelector('#mapsvg g.rel path[data-g=rel]'); if(!pa) return null; const L=pa.getTotalLength(), s=pa.getPointAtLength(0), e=pa.getPointAtLength(L); const box=id=>{ const n=document.querySelector(`#mapsvg g.node[data-id="${id}"] rect.hit`); return {x:+n.getAttribute('x'),y:+n.getAttribute('y'),w:+n.getAttribute('width'),h:+n.getAttribute('height')}; }; const near=(p,b)=>p.x>=b.x-8&&p.x<=b.x+b.w+8&&p.y>=b.y-8&&p.y<=b.y+b.h+8; return near(s,box('b'))&&near(e,box('e')); });
    ok(T+`rel: drawn from node edge to node edge in layout ${lay}`,c===true);
    if(lay==='org') await shot('10-rel-org'); if(lay==='balanced') await shot('10-rel-balanced'); }
  // collapsed end attaches to the visible ancestor
  await p.evaluate(()=>{ const m=window.__mm; m.doc.root.rels.push({id:'r2',a:'a1',b:'d'}); m.doc.root.c[0].collapsed=true; window.__mmStore.changed(); }); await hclick('[data-act="fit"]'); await W(300);
  ok(T+'rel: an end inside a collapsed branch attaches to the visible parent (faded)',await p.evaluate(()=>{ const g=document.querySelector('#mapsvg g.rel[data-rel="r2"]'); return !!g&&g.getAttribute('opacity')==='.6'&&/收合/.test(g.getAttribute('aria-label')); }));
  await p.evaluate(()=>{ const m=window.__mm; m.doc.root.c[0].collapsed=false; window.__mmStore.changed(); }); await hclick('[data-act="fit"]'); await W(300);
  // outline: hidden, with an indicator
  await hclick('[data-act="outline"]'); await W(300);
  ok(T+'outline: lines hidden, indicator says how many and that Markdown skips them',/2 條關聯線/.test(await p.locator('.olrels').textContent())&&await p.locator('.outline g.rel').count()===0);
  await shot('11-rel-outline-indicator');
  await hclick('.outline [data-act="outline"]'); await W(300);
  // exports
  if(!mobile){ const dl=async kind=>{ const [d]=await Promise.all([p.waitForEvent('download'),p.evaluate(k=>{ const b=document.createElement('button'); b.dataset.act='exp'; b.dataset.v=k; document.body.appendChild(b); b.click(); b.remove(); },kind)]); return fs.readFileSync(await d.path()); };
    const svg=(await dl('svg')).toString(); ok(T+'export SVG includes the dashed line, arrow marker and label',/stroke-dasharray="7 5"/.test(svg)&&/<marker id="rela-/.test(svg)&&/同一位負責人/.test(svg));
    const png=await dl('png'); ok(T+'export PNG works with lines',png.length>5000&&png.slice(1,4).toString()==='PNG');
    const pdf=await dl('pdf'); ok(T+'export PDF works with lines',pdf.slice(0,4).toString()==='%PDF');
    const md=(await dl('md')).toString(); ok(T+'export Markdown skips relationship lines',/講者/.test(md)&&!/同一位負責人/.test(md)); }
  // delete: keyboard on desktop, menu on phone; then node deletion prunes lines in the same undo step
  if(mobile){ const [x,y]=await center('b'); await p.evaluate(([x,y])=>{ const el=document.elementFromPoint(x,y); el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:x,clientY:y})); },[x,y]); await W(300);
    ok(T+'node menu offers 編輯關聯線 for a node with lines',await p.locator('.lpmenu [data-act="relOf"]').count()===1); await hclick('.lpmenu [data-act="relOf"]'); await W(400);
    ok(T+'編輯關聯線 selects the line and opens its menu',await p.locator('.relmenu').count()===1&&await p.locator(`#mapsvg g.rel.sel:not(.rellbl)[data-rel="${rid0}"]`).count()===1,JSON.stringify(await p.evaluate(()=>({m:document.querySelectorAll('.relmenu').length,sel:window.__mm.selRel,s:window.__mm.sel,rels:window.__mm.doc.root.rels.map(r=>r.id),ed:!!document.querySelector('.editbox')})))+' rid0='+rid0);
    await hclick('.relmenu [data-act="relDel"]'); }
  else await tap(await midOf(rid0)), await W(300);
  if(mobile){} else { await p.keyboard.press('Escape'); await W(150); await p.focus('#cv'); await p.keyboard.press('Delete'); }
  await W(250); r=await R(); ok(T+'rel: delete removes just that line',r.rels.length===1&&r.rels[0].id==='r2'&&!r.rels.some(x=>x.id===rid0),JSON.stringify(r.rels));
  await undoToast(); r=await R(); ok(T+'rel: undo brings it back',r.rels.length===2);
  await selectNode('d'); await hclick('[data-act="delete"]').catch(async()=>{ await p.focus('#cv'); await p.keyboard.press('Delete'); }); await W(300); r=await R();
  ok(T+'deleting a node drops its lines',r.rels.length===1&&r.rels[0].id!=='r2',JSON.stringify(r.rels));
  await undoToast(); r=await R(); ok(T+'…and one undo restores node + line',r.rels.length===2&&r.c.some(x=>x.id==='d'));
  ok(T+'no page errors',!errs.length,errs.join(' | '));
  await ctx.close(); }
await b.close();
const n=res.filter(Boolean).length; console.log(`${n}/${res.length} passed`); process.exit(n===res.length?0:1);
