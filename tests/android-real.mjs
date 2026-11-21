// v1.3.3 regression: model what a REAL Android phone does after the editor gets focus, which plain emulation does not:
//  (a) the on-screen keyboard opens → the viewport shrinks (window resize + visualViewport resize), several times;
//  (b) ~300 ms after the tap the browser sends compatibility mousedown/click at the same point; if a handler does not
//      cancel mousedown, the browser moves focus to the focusable thing under the finger (we emulate that default action);
//  (c) Gboard/IME composition keeps typing into the editor for a while.
// The editor must stay the SAME element, stay focused, and keep the text for 2 s. Also: ?debug=focus shows an on-screen log.
// Run: BASE=http://localhost:8765/ node tests/android-real.mjs
import { chromium, devices } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push(!!c);console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({executablePath:exe});
const seed=()=>{ if(sessionStorage.s) return; sessionStorage.s=1; localStorage.clear(); const d={format:'mymind/1',id:'hf',theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:{id:'r',t:'根',c:[{id:'a',t:'甲'},{id:'b',t:'乙'},{id:'c',t:'丙'},{id:'d',t:'丁'}]}}; localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'})); localStorage.setItem('mymind.index',JSON.stringify([{id:'hf',title:'根',icon:'🧠',theme:'coral',updated:d.updated,created:d.created}])); localStorage.setItem('mymind.map.hf',JSON.stringify(d)); };
const FULL={width:412,height:915};
async function phone(q=''){
  const ctx=await b.newContext({...devices['Pixel 7'],locale:'zh-TW'});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.addInitScript(seed);
  // track blur of any editor and whether the editor element is ever replaced/detached
  await ctx.addInitScript(()=>{ window.__ev=[]; document.addEventListener('focusout',e=>{ if(e.target.classList&&e.target.classList.contains('editbox')) window.__ev.push('editor-blur→'+(e.relatedTarget?(e.relatedTarget.id||e.relatedTarget.className||e.relatedTarget.tagName):'none')); },true); });
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.ctx=ctx;
  await p.goto(BASE+'?nosw'+q+'#/map/hf'); await p.waitForSelector('body[data-ready="1"]'); await W(600); return p; }
const center=(p,id)=>p.evaluate(id=>{ const r=document.querySelector(`#mapsvg g.node[data-id="${id}"] rect.hit`).getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; },id);
// the keyboard: shrink in two steps (Gboard animates), fire window + visualViewport resize each time
async function keyboardOpens(p){ for(const h of [FULL.height-160,FULL.height-300]){ await p.setViewportSize({width:FULL.width,height:h}); await p.evaluate(()=>{ dispatchEvent(new Event('resize')); window.visualViewport&&visualViewport.dispatchEvent(new Event('resize')); }); await W(120); } await W(350); /* past any debounced resize handler */ }
async function keyboardCloses(p){ await p.setViewportSize(FULL); await p.evaluate(()=>{ dispatchEvent(new Event('resize')); window.visualViewport&&visualViewport.dispatchEvent(new Event('resize')); }); await W(250); }
// delayed compatibility mouse events at the tap point, with the browser's default action (focus moves) when not cancelled
const compatMouse=(p,x,y)=>p.evaluate(([x,y])=>{ const t=document.elementFromPoint(x,y)||document.body; const o={bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,view:window,detail:1};
  const md=new MouseEvent('mousedown',o); const notCancelled=t.dispatchEvent(md);
  if(notCancelled){ const f=t.closest&&t.closest('input,textarea,select,button,a[href],[tabindex]'); if(f) f.focus(); else if(document.activeElement&&document.activeElement!==document.body) document.activeElement.blur(); }
  t.dispatchEvent(new MouseEvent('mouseup',o)); t.dispatchEvent(new MouseEvent('click',o)); return {target:t.id||t.getAttribute('class')||t.tagName,cancelled:!notCancelled}; },[x,y]);
const edState=p=>p.evaluate(()=>{ const e=document.querySelector('#ovl .editbox'); return {ed:!!e,same:!!e&&e===window.__edEl,focused:!!e&&document.activeElement===e,val:e?e.value:null,editing:!!window.__mm.editing,ev:window.__ev.slice()}; });
const markEditor=p=>p.evaluate(()=>{ window.__edEl=document.querySelector('#ovl .editbox'); window.__ev=[]; });
async function holds(p,name,want){ // check every 250 ms for 2 s
  let bad=null; for(let i=0;i<8;i++){ await W(250); const s=await edState(p); if(!(s.ed&&s.same&&s.focused&&s.editing&&(want==null||s.val===want))){ bad=s; break; } }
  ok(name,!bad,bad?JSON.stringify(bad):''); }
const cdpOf=async p=>p.cdp||(p.cdp=await p.ctx.newCDPSession(p));
async function ime(p,parts,final){ const c=await cdpOf(p); for(const t of parts){ await c.send('Input.imeSetComposition',{text:t,selectionStart:t.length,selectionEnd:t.length}); await W(60); } await c.send('Input.insertText',{text:final}); await W(80); }
{ // A. tap selected node again → editor; keyboard resizes the viewport; compat mouse arrives 300 ms later; IME typing
  const p=await phone(); let [x,y]=await center(p,'b');
  await p.touchscreen.tap(x,y); await W(700); await p.touchscreen.tap(x,y); await W(30); await markEditor(p);
  let s=await edState(p); ok('A: second tap opens a focused editor',s.ed&&s.focused,JSON.stringify(s));
  await keyboardOpens(p); s=await edState(p); ok('A: keyboard resize does not re-create, move away or blur the editor',s.ed&&s.same&&s.focused,JSON.stringify(s));
  await W(150); const cm=await compatMouse(p,x,y); s=await edState(p); ok('A: delayed compat mousedown/click at the tap point keeps focus in the editor',s.ed&&s.same&&s.focused,JSON.stringify({cm,...s}));
  await p.evaluate(()=>{ const e=document.querySelector('.editbox'); e&&e.select(); });
  await ime(p,['ㄓ','ㄓㄨㄥ','中'],'中文'); await holds(p,'A: IME text kept and editor stays focused for 2 s','中文');
  ok('A: editor fully visible above the keyboard',await p.evaluate(()=>{ const e=document.querySelector('.editbox'); if(!e) return false; const r=e.getBoundingClientRect(); const vh=window.visualViewport?visualViewport.height:innerHeight; return r.top>=0&&r.bottom<=vh; }));
  ok('A: editor font ≥16px (no auto-zoom)',await p.evaluate(()=>{ const e=document.querySelector('.editbox'); return e?parseFloat(getComputedStyle(e).fontSize):0; })>=16);
  if(SHOTS) await p.screenshot({path:SHOTS+'/android-keyboard-editing.png'});
  const evA=await p.evaluate(()=>window.__ev.slice());
  await p.keyboard.press('Enter'); await W(250); ok('A: Enter saves the IME text',await p.evaluate(()=>window.__mm.doc.root.c[1].t)==='中文');
  await keyboardCloses(p); ok('A: after editing, a deferred resize re-layout happens without errors',await p.locator('#mapsvg g.node').count()===5&&!p.errs.length,p.errs.join('|'));
  ok('A: editor never blurred from opening until Enter',!evA.length,JSON.stringify(evA));
  await p.ctx.close(); }
{ // B. ✏️ 編輯 button path (the tap target disappears when editing starts)
  const p=await phone(); let [x,y]=await center(p,'c'); await p.touchscreen.tap(x,y); await W(400);
  const eb=await p.locator('.nodetb [data-act="edit"]').boundingBox(); const bx=eb.x+eb.width/2, by=eb.y+eb.height/2; await p.touchscreen.tap(bx,by); await W(30); await markEditor(p);
  await keyboardOpens(p); await W(150); await compatMouse(p,bx,by);
  await p.evaluate(()=>document.querySelector('.editbox')?.select()); await ime(p,['ㄅ','ㄅㄧˇ'],'筆記'); await holds(p,'B: ✏️ 編輯 → keyboard + compat mouse + IME: editor stays focused 2 s with text','筆記');
  await p.keyboard.press('Enter'); await W(200); ok('B: saved',await p.evaluate(()=>window.__mm.doc.root.c[2].t)==='筆記'); await p.ctx.close(); }
{ // C. Gboard sends keyCode 229 on a selected node (no editor yet) → editor; keyboard resize while composing
  const p=await phone(); let [x,y]=await center(p,'d'); await p.touchscreen.tap(x,y); await W(400); const c=await cdpOf(p);
  await p.evaluate(()=>document.querySelector('#cv').focus());
  await c.send('Input.dispatchKeyEvent',{type:'rawKeyDown',windowsVirtualKeyCode:229,nativeVirtualKeyCode:229,key:'Process',code:'KeyJ'}); await W(40); await markEditor(p);
  await c.send('Input.imeSetComposition',{text:'ㄉ',selectionStart:1,selectionEnd:1}); await keyboardOpens(p);
  await c.send('Input.imeSetComposition',{text:'ㄉㄧㄥ',selectionStart:3,selectionEnd:3}); await c.send('Input.insertText',{text:'丁丁'}); await holds(p,'C: IME start on a selected node survives the keyboard resize','丁丁');
  await p.keyboard.press('Enter'); await W(200); ok('C: saved',await p.evaluate(()=>window.__mm.doc.root.c[3].t)==='丁丁'); await p.ctx.close(); }
{ // D. transient blur (Gboard / window focus flicker) does not commit; a real tap elsewhere still commits
  const p=await phone(); let [x,y]=await center(p,'a'); await p.touchscreen.tap(x,y); await W(700); await p.touchscreen.tap(x,y); await W(30); await markEditor(p);
  await p.evaluate(()=>{ const e=document.querySelector('.editbox'); e.value='暫時'; e.blur(); }); await W(400);
  let s=await edState(p); ok('D: a transient blur to nothing right after opening does not close the editor (focus returns)',s.ed&&s.editing&&s.focused&&s.val==='暫時',JSON.stringify(s));
  await W(1600); const [ex,ey]=[20,420]; await p.touchscreen.tap(ex,ey); await W(400); s=await edState(p);
  ok('D: tapping empty canvas later commits the edit',!s.ed&&!s.editing&&await p.evaluate(()=>window.__mm.doc.root.c[0].t)==='暫時',JSON.stringify(s));
  await p.ctx.close(); }
{ // F. the echo guard only swallows the opening tap's own compat events: a quick real tap on another button still works
  const p=await phone(); let [x,y]=await center(p,'a'); await p.touchscreen.tap(x,y); await W(700); await p.touchscreen.tap(x,y); await W(150);
  const mb=await p.locator('.rb.more').boundingBox(); await p.touchscreen.tap(mb.x+mb.width/2,mb.y+mb.height/2); await W(300);
  ok('F: tapping ⋯ right after opening the editor still opens the menu (and commits the edit)',await p.locator('.ctx, .lpmenu, [role=menu]').count()>0&&!(await edState(p)).editing,JSON.stringify(await edState(p)));
  await p.ctx.close(); }
{ // E. ?debug=focus on-screen log
  const p=await phone('&debug=focus'); let [x,y]=await center(p,'a'); await p.touchscreen.tap(x,y); await W(700); await p.touchscreen.tap(x,y); await W(200); await keyboardOpens(p); await W(200);
  const t=await p.locator('#mmdebug').textContent().catch(()=>'');
  ok('E: ?debug=focus shows an on-screen log with focus, resize and editor events',/focusin/.test(t)&&/resize/.test(t)&&/editbox|editor/.test(t),t.slice(0,200));
  ok('E: the debug log never takes focus or taps (pointer-events none)',await p.evaluate(()=>{ const d=document.querySelector('#mmdebug'); return d?getComputedStyle(d).pointerEvents:''; })==='none'&&(await edState(p)).focused);
  if(SHOTS) await p.screenshot({path:SHOTS+'/android-debug-focus.png'});
  const q=await phone(); ok('E: no debug log without the flag',await q.locator('#mmdebug').count()===0); await q.ctx.close(); await p.ctx.close(); }
await b.close(); const n=res.filter(Boolean).length; console.log(`${n}/${res.length} passed`); process.exit(n===res.length?0:1);
