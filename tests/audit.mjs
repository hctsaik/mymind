// Accessibility & layout audit of the REAL app (ported from the design-gate checks).
// Text contrast ≥4.5 (≥3 large), graphics ≥3:1, chrome/node overlap, tap targets ≥44 on mobile.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { CONTRAST, GFX, TAP, check } from './audit-lib.mjs';
import { mockGH, aiHandler } from './mock.mjs';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/';
const OUT=process.env.OUT||'/tmp/mm/audit-app.json';
const b=await chromium.launch({executablePath:exe});
const THEMES=['coral','peach','latte','vivid','fresh','macaron','business','forest','midnight','minimal'];
let seq=0; const id=()=>'n'+(++seq);
const N=(t,c,x={})=>({id:id(),t,...x,...(c&&c.length?{c}:{})});
const trip=()=>N('名古屋三天兩夜',[N('行程',[N('Day 1 熱田神宮',[N('宮きしめん')]),N('Day 2 名古屋城',[],{icon:'🏯',pri:1}),N('Day 3 大須商店街',[],{done:true})]),
  N('美食',[N('味噌豬排',[],{hl:true}),N('鰻魚飯三吃',[],{note:'蓬萊軒要先排隊'}),N('手羽先')],{icon:'🍜'}),N('交通',[N('中部國際機場 → 名鐵',[],{pri:2}),N('地鐵一日券')]),
  N('預算',[N('住宿 NT$9,000'),N('交通 NT$2,500'),N('餐飲 NT$6,000')],{collapsed:false}),N('待辦',[N('買 eSIM',[],{pri:3}),N('換日幣')])]);
const dense=()=>N('2027 年度產品規劃與團隊目標總覽',Array.from({length:9},(_,i)=>N(`第 ${i+1} 個策略方向：提升使用者留存與滿意度`,Array.from({length:5},(_,j)=>N(`子項目 ${i+1}.${j+1} 需要跨部門協作並在第二季前完成`,Array.from({length:3},(_,k)=>N(`細節 ${k+1}`)))))));
function docOf(root,theme='coral',extra={}){ return {format:'mymind/1',id:'m'+(++seq),theme,settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root,...extra}; }
async function page(w,h,{prefs={mode:'local'},docs=[],gh,hash='#/'}={}){
  const m=w<700; const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:m,hasTouch:m,deviceScaleFactor:1});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.route('https://api.openai.com/**',aiHandler); if(gh) await ctx.route('https://api.github.com/**',gh.handler);
  await ctx.addInitScript(({prefs,docs,pat})=>{ if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.clear(); if(prefs) localStorage.setItem('mymind.prefs',JSON.stringify(prefs)); if(pat) localStorage.setItem('mymind.pat',JSON.stringify(pat));
    localStorage.setItem('mymind.index',JSON.stringify(docs.map(d=>({id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created,star:!!d.star,trashed:false})))); docs.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{prefs,docs,pat:gh?'github_pat_FAKE':null});
  const p=await ctx.newPage(); await p.goto(BASE+hash); await p.waitForSelector('body[data-ready="1"]'); await p.waitForTimeout(400); p.ctx=ctx; return p; }
const act=async(p,a,v)=>{ const ok=await p.evaluate(([a,v])=>{ const els=[...document.querySelectorAll(`[data-act="${a}"]${v?`[data-v="${v}"]`:''}`)].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed'); if(!els[0]) return false; els[0].click(); return true; },[a,v]); await p.waitForTimeout(300); if(!ok) throw new Error('no visible act '+a+' '+(v||'')); };
const selectL1=async p=>{ await p.evaluate(()=>{const S=window.__mm; S.sel=S.doc.root.c[1].id;}); await p.locator('#cv').focus(); };
const results={contrast:{total:0,fails:[],min:99},gfx:{total:0,fails:[],min:99,unclassified:0},tap:{total:0,under44:[],min:99},overlap:{views:0,problems:[]},views:[]};
async function audit(p,name,{tap}={}){ const w=p.viewportSize().width; const key=`${name}@${w}`; results.views.push(key);
  const c=await p.evaluate(CONTRAST); results.contrast.total+=c.length; for(const x of c){ results.contrast.min=Math.min(results.contrast.min,x.ratio); if(x.ratio<x.need) results.contrast.fails.push({view:key,...x}); }
  const g=await p.evaluate(GFX); for(const x of g.res){ if(x.lightOpt||name.startsWith('lightlines')&&['edge','node','collapse','chip'].includes(x.kind)&&x.where==='map'){ results.gfx.lightOptExcluded=(results.gfx.lightOptExcluded||0)+1; continue; } results.gfx.total++; results.gfx.min=Math.min(results.gfx.min,x.ratio); if(x.ratio<3) results.gfx.fails.push({view:key,...x}); } results.gfx.unclassified+=g.unclassified.length;
  const k=await p.evaluate(check); results.overlap.views++; const probs=[]; if(k.chromeOverNode&&k.chromeOverNode.length) probs.push({chromeOverNode:k.chromeOverNode}); if(k.overlaps&&k.overlaps.length) probs.push({overlaps:k.overlaps}); if(k.map&&k.map.l1HorizClipped&&k.map.l1HorizClipped.length) probs.push({l1HorizClipped:k.map.l1HorizClipped}); if(k.orphans&&k.orphans.length) probs.push({orphans:k.orphans});
  if(probs.length) results.overlap.problems.push({view:key,probs});
  if(w<700||tap){ const t=await p.evaluate(TAP); results.tap.total+=t.length; for(const x of t){ const m=Math.min(x.w,x.h); results.tap.min=Math.min(results.tap.min,m); if(m<44&&w<700) results.tap.under44.push({view:key,...x}); } } }
for(const [w,h] of [[1440,900],[390,844]]){
  const docs=[docOf(trip()),docOf(dense(),'fresh'),docOf(trip(),'midnight',{star:true})]; const T=docs[0].id, D=docs[1].id;
  // first run / empty
  { const p=await page(w,h,{prefs:null}); await audit(p,'welcome'); await p.ctx.close(); }
  { const p=await page(w,h); await audit(p,'empty'); await p.ctx.close(); }
  // list
  { const p=await page(w,h,{docs}); await audit(p,'list'); if(w<700){ await act(p,'nav'); await audit(p,'nav-drawer'); } await p.ctx.close(); }
  // every theme on the trip map, plus light lines
  for(const t of THEMES){ const d=docOf(trip(),t); const p=await page(w,h,{docs:[d],hash:'#/map/'+d.id}); await audit(p,'theme-'+t); await p.ctx.close(); }
  for(const t of ['coral','midnight','minimal']){ const d=docOf(trip(),t); const p=await page(w,h,{prefs:{mode:'local',lines:'light'},docs:[d],hash:'#/map/'+d.id}); await audit(p,'lightlines-'+t); await p.ctx.close(); }
  // dense map, fit, levels
  { const p=await page(w,h,{docs,hash:'#/map/'+D}); await audit(p,'dense'); if(w>700){ await act(p,'fit'); await audit(p,'dense-fit'); await act(p,'level','2'); await audit(p,'dense-l2'); } await p.ctx.close(); }
  // panels
  { const p=await page(w,h,{docs,hash:'#/map/'+T}); await selectL1(p);
    await act(p,'style'); for(const tab of ['theme','node','layout','canvas']){ await act(p,'tab',tab); await audit(p,'style-'+tab); } await act(p,'closePanel').catch(()=>{});
    await selectL1(p); await p.keyboard.press('Control+Alt+m'); await p.waitForTimeout(300); await audit(p,'note'); await act(p,'closePanel').catch(()=>{});
    await act(p,'outline'); await audit(p,'outline'); await act(p,'outline');
    if(w<700){ await act(p,'moreMenu'); await audit(p,'more-menu'); await p.keyboard.press('Escape'); }
    else { await act(p,'exportMenu'); await audit(p,'export-menu'); await p.keyboard.press('Escape'); }
    const nb=await p.locator('#mapsvg g.node').nth(2).boundingBox(); await p.mouse.click(nb.x+nb.width/2,nb.y+nb.height/2,{button:'right'}); await p.waitForTimeout(200); await audit(p,'node-menu'); await p.keyboard.press('Escape');
    await selectL1(p); await act(p,'ai').catch(()=>act(p,'aiExpand')); await audit(p,'ai-dialog'); await act(p,'aiRun'); await audit(p,'ai-nokey'); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    await act(p,'settings').catch(async()=>{ await act(p,'moreMenu'); await act(p,'settings'); }); await p.click('#st-gh'); await p.waitForTimeout(150); await audit(p,'settings-gh'); await p.click('#st-a11y'); await p.waitForTimeout(150); await audit(p,'settings-a11y'); await p.keyboard.press('Escape');
    await p.ctx.close(); }
  // dark UI
  { const p=await page(w,h,{prefs:{mode:'local',ui:'dark'},docs,hash:'#/map/'+docs[2].id}); await audit(p,'dark-editor'); await act(p,'style'); await audit(p,'dark-style'); await p.goto(BASE+'#/'); await p.waitForTimeout(300); await audit(p,'dark-list'); await p.ctx.close(); }
  // settings: storage tab; manual sync with unsynced badge
  { const p=await page(w,h,{docs}); await act(p,'settings').catch(async()=>{ await act(p,'nav'); await act(p,'settings'); }); await audit(p,'settings-data'); await p.ctx.close(); }
  { const gh=mockGH(); const d=docOf(trip()); const p=await page(w,h,{prefs:{mode:'github',repo:'hctsaik/mymind-data',sync:'manual'},docs:[d,docOf(dense(),'fresh')],gh,hash:'#/map/'+d.id}); await p.waitForTimeout(1500); await audit(p,'sync-manual-badge'); await p.goto(BASE+'#/'); await p.waitForTimeout(400); await audit(p,'list-manual'); if(w<700){ await act(p,'nav'); await audit(p,'nav-manual'); } await p.ctx.close(); }
  { const p=await page(w,h,{prefs:{mode:'local',ui:'dark'},docs}); await audit(p,'dark-list-backupnote'); await act(p,'settings').catch(async()=>{ await act(p,'nav'); await act(p,'settings'); }); await audit(p,'dark-settings-data'); await p.ctx.close(); }
  // GitHub mode: history + conflict
  { const gh=mockGH(); const d=docOf(trip()); const p=await page(w,h,{prefs:{mode:'github',repo:'hctsaik/mymind-data',sync:'manual'},docs:[d],gh,hash:'#/map/'+d.id}); await p.keyboard.press('Control+s'); await p.waitForTimeout(2500);
    await selectL1(p); await p.keyboard.press('Tab'); await p.keyboard.type('新節點'); await p.keyboard.press('Enter'); await p.keyboard.press('Control+s'); await p.waitForTimeout(2500);
    await act(p,'history').catch(async()=>{ await act(p,'moreMenu'); await act(p,'history'); }); await p.waitForTimeout(500); await audit(p,'history');
    await p.locator('.hist li').last().click(); await p.waitForTimeout(500); await audit(p,'history-preview'); await act(p,'endPreview').catch(()=>{});
    gh.serverEdit(`maps/${d.id}.json`,x=>{x.root.c[0].t='雲端版本';}); await selectL1(p); await p.keyboard.press('Tab'); await p.keyboard.type('本機'); await p.keyboard.press('Enter'); await p.keyboard.press('Control+s'); await p.waitForTimeout(2500);
    await audit(p,'conflict'); await p.ctx.close(); }
}
await b.close();
results.contrast.fails=results.contrast.fails.slice(0,40); results.gfx.fails=results.gfx.fails.slice(0,40);
fs.writeFileSync(OUT,JSON.stringify(results,null,1));
const sum={views:results.views.length,contrast:{total:results.contrast.total,fails:results.contrast.fails.length,min:results.contrast.min},gfx:{lightOptExcluded:results.gfx.lightOptExcluded||0,total:results.gfx.total,fails:results.gfx.fails.length,min:results.gfx.min,unclassified:results.gfx.unclassified},tap:{total:results.tap.total,under44:results.tap.under44.length},overlapProblems:results.overlap.problems.length};
console.log(JSON.stringify(sum,null,1));
if(results.contrast.fails.length) console.log('contrast fails',JSON.stringify(results.contrast.fails.slice(0,10)));
if(results.gfx.fails.length) console.log('gfx fails',JSON.stringify(results.gfx.fails.slice(0,10)));
if(results.tap.under44.length) console.log('tap',JSON.stringify(results.tap.under44.slice(0,15)));
if(results.overlap.problems.length) console.log('overlap',JSON.stringify(results.overlap.problems.slice(0,8)));
process.exit(sum.contrast.fails||sum.gfx.fails||sum.tap.under44||sum.overlapProblems?1:0);
