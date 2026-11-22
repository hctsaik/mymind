// v1.8.1: editing a long multi-line node on a phone — the editor grows to show all the text, wraps at a comfortable width,
// stays above the on-screen keyboard (visualViewport, simulated here) and scrolls inside only when it can't fit.
// Coral (default) and 經典蜜桃 maps at 390px. Run: BASE=http://localhost:8765/ node tests/editor-grow.mjs  (SHOTS=dir)
import { chromium } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push([n,!!c]);console.log((c?'PASS ':'FAIL ')+n+(i&&!c?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const N=(id,t,c,x={})=>({id,t,...(c?{c}:{}),...x});
const LONG='第一行：這是一段很長的筆記內容\n第二行：要能完整看到\n第三行：每一個字都不能被切掉\n第四行：繼續寫下去\n第五行：還有更多\n第六行：最後一行在這裡';
const HUGE=Array.from({length:40},(_,i)=>`第 ${i+1} 行：非常非常長的內容`).join('\n');
const gs={v:1,bg:'#f5f9fc',maxW:400,layout:'right',lv:[{fs:20,fill:'#2f6fd0',color:'#ffffff',r:8},{fs:16,fill:'#e8f0fd',color:'#1f2329',r:6},{fs:14,color:'#1f2329'}],assets:{}};
const mk=(id,theme,x)=>({format:'mymind/1',id,theme,settings:theme==='classic'?{layout:'right'}:{},icon:'📝',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',
  root:N(id+'0','長文字',[N(id+'1',LONG),N(id+'2',HUGE),N(id+'3','短')],x)});
const docs=[mk('ed','coral'),mk('ec','classic',{gs})];
const b=await chromium.launch({executablePath:exe});
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await ctx.addInitScript(({docs})=>{ // a controllable visualViewport: __kb(px) = keyboard height
  const T=new EventTarget(); let kb=0; const vv={get width(){return innerWidth},get height(){return innerHeight-kb},offsetTop:0,offsetLeft:0,pageTop:0,scale:1,addEventListener:(...a)=>T.addEventListener(...a),removeEventListener:(...a)=>T.removeEventListener(...a)};
  Object.defineProperty(window,'visualViewport',{get:()=>vv}); window.__kb=h=>{ kb=h; T.dispatchEvent(new Event('resize')); };
  if(sessionStorage.seeded) return; sessionStorage.seeded=1; localStorage.clear();
  localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'}));
  localStorage.setItem('mymind.index',JSON.stringify(docs.map(d=>({id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created})))); docs.forEach(d=>localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d))); },{docs});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const box=sel=>p.locator(sel).first().boundingBox();
const tapAt=async(x,y)=>{ await p.touchscreen.tap(x,y); await W(400); };
const edInfo=()=>p.evaluate(()=>{ const t=document.querySelector('#ovl .editbox'); if(!t) return null; const r=t.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,w:r.width,h:r.height,sh:t.scrollHeight,ch:t.clientHeight,st:t.scrollTop,ov:getComputedStyle(t).overflowY,vvb:visualViewport.height}; });
async function openEditor(id){ await p.evaluate(()=>{ if(window.__mm.editing) document.querySelector('#ovl .editbox')?.blur(); }); await p.keyboard.press('Escape').catch(()=>{}); await W(200);
  await p.evaluate(id=>{ const S=window.__mm; S.sel=null; const g=document.querySelector(`#mapsvg g.node[data-id="${id}"] rect.hit`); const r=g.getBoundingClientRect(); S.vp={...S.vp,tx:S.vp.tx+(195-(r.x+r.width/2)),ty:S.vp.ty+(Math.max(120,420-r.height/2)-r.y)}; document.querySelector('#vp').setAttribute('transform',`translate(${S.vp.tx},${S.vp.ty}) scale(${S.vp.sc})`); },id); await W(100);
  const hb=await p.evaluate(id=>{ const g=document.querySelector(`#mapsvg g.node[data-id="${id}"] rect.hit`)||document.querySelector(`#mapsvg g.node[data-id="${id}"]`); if(!g) return null; g.scrollIntoView&&0; const r=g.getBoundingClientRect(); return [r.x+Math.min(r.width/2,40),r.y+Math.min(r.height/2,20)]; },id);
  if(!hb) throw new Error('node not on screen '+id);
  await tapAt(...hb); if(await p.locator('.nodetb [data-act="edit"]').count()===0) await tapAt(...hb);
  const e=await box('.nodetb [data-act="edit"]'); await tapAt(e.x+e.width/2,e.y+e.height/2); await p.waitForSelector('#ovl .editbox'); await W(450); }
for(const [mid,label] of [['ed','珊瑚'],['ec','經典蜜桃']]){
  await p.goto(BASE+'#/map/'+mid); await p.waitForSelector('#mapsvg g.node'); await W(400);
  await p.evaluate(()=>window.__kb(0)); await p.click('[data-act="fit"]',{force:true}).catch(()=>{}); await W(200);
  // center the long node
  await p.evaluate(id=>{ const S=window.__mm; const g=document.querySelector(`#mapsvg g.node[data-id="${id}"] rect.hit`); const r=g.getBoundingClientRect(); S.vp={...S.vp,tx:S.vp.tx+(195-(r.x+r.width/2)),ty:S.vp.ty+(420-(r.y+r.height/2))}; document.querySelector('#vp').setAttribute('transform',`translate(${S.vp.tx},${S.vp.ty}) scale(${S.vp.sc})`); },mid+'1');
  await openEditor(mid+'1'); let e=await edInfo();
  ok(`${label}: editor shows all lines of a 6-line node (no clipping)`,e&&e.sh<=e.ch+2&&e.ov==='hidden',JSON.stringify(e));
  ok(`${label}: editor wraps at a comfortable width inside the screen`,e&&e.w>=270&&e.left>=11&&e.right<=379,JSON.stringify(e));
  if(SHOTS) await p.screenshot({path:`${SHOTS}/editor-${mid}-open.png`});
  await p.evaluate(()=>window.__kb(320)); await W(300); e=await edInfo();
  ok(`${label}: with the keyboard up the editor is fully above it`,e&&e.bottom<=e.vvb-8+0.5&&e.top>=60&&e.sh<=e.ch+2,JSON.stringify(e));
  if(SHOTS) await p.screenshot({path:`${SHOTS}/editor-${mid}-keyboard.png`});
  await p.keyboard.press('Control+End'); await p.keyboard.press('Shift+Enter'); await p.keyboard.type('第七行：新加的'); await W(250); e=await edInfo();
  ok(`${label}: typing more lines grows the editor and stays above the keyboard`,e&&e.sh<=e.ch+2&&e.bottom<=e.vvb-8+0.5,JSON.stringify(e));
  await p.keyboard.press('Enter'); await W(300);
  const t=await p.evaluate(id=>{ const f=n=>n.id===id?n:(n.c||[]).map(f).find(Boolean); return f(window.__mm.doc.root).t; },mid+'1');
  ok(`${label}: text saved with all lines`,t.endsWith('第七行：新加的')&&t.split('\n').length===7);
  // 40 lines: capped to the room above the keyboard, scrolls inside, caret visible
  await p.evaluate(()=>window.__kb(0)); await W(200);
  await openEditor(mid+'2'); await p.evaluate(()=>window.__kb(320)); await W(350); e=await edInfo();
  ok(`${label}: a 40-line node is capped above the keyboard and scrolls inside`,e&&e.ov==='auto'&&e.bottom<=e.vvb-8+0.5&&e.top>=60&&e.h>=200,JSON.stringify(e));
  await p.keyboard.press('Control+End'); await p.keyboard.type('X'); await W(200); e=await edInfo();
  ok(`${label}: caret at the end is visible (scrolled to the bottom)`,e&&e.st+e.ch>=e.sh-4,JSON.stringify(e));
  if(SHOTS) await p.screenshot({path:`${SHOTS}/editor-${mid}-huge.png`});
  await p.keyboard.press('Escape'); await W(200); await p.evaluate(()=>window.__kb(0)); await W(200);
}
ok('no page errors',errs.length===0,errs.join(' | '));
await b.close(); const pass=res.filter(r=>r[1]).length; console.log(`${pass}/${res.length} passed`); process.exit(pass===res.length?0:1);
