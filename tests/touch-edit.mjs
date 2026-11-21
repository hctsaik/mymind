// v1.3.2 regression: on a phone (Android Chrome emulation, touch) a node can be edited and typed into.
// tap → select; tap again → editor with focus inside the gesture (keyboard opens); ✏️ 編輯 button; double tap;
// typing / IME (keyCode 229 + composition) on a selected node starts editing without breaking the composition.
// Run: BASE=http://localhost:8765/ node tests/touch-edit.mjs
import { chromium, devices } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/'; const SHOTS=process.env.SHOTS||'';
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({executablePath:exe});
const seed=()=>{ if(sessionStorage.s) return; sessionStorage.s=1; localStorage.clear(); const d={format:'mymind/1',id:'hf',theme:'coral',settings:{},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root:{id:'r',t:'根',c:[{id:'a',t:'甲'},{id:'b',t:'乙'},{id:'c',t:'丙'}]}}; localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'})); localStorage.setItem('mymind.index',JSON.stringify([{id:'hf',title:'根',icon:'🧠',theme:'coral',updated:d.updated,created:d.created}])); localStorage.setItem('mymind.map.hf',JSON.stringify(d)); };
const ctx=await b.newContext({...devices['Pixel 7'],locale:'zh-TW'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await ctx.addInitScript(seed);
await ctx.addInitScript(()=>{ const f=HTMLElement.prototype.focus; window.__focusLog=[]; HTMLElement.prototype.focus=function(...a){ if(this.classList&&this.classList.contains('editbox')) window.__focusLog.push(navigator.userActivation?navigator.userActivation.isActive:null); return f.apply(this,a); }; });
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'?nosw#/map/hf'); await p.waitForSelector('body[data-ready="1"]'); await W(600);
const center=id=>p.evaluate(id=>{ const r=document.querySelector(`#mapsvg g.node[data-id="${id}"] rect.hit`).getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; },id);
const st=()=>p.evaluate(()=>({sel:window.__mm.sel,editing:!!document.querySelector('.editbox'),focus:document.activeElement&&document.activeElement.className}));
const T=(x,y)=>p.touchscreen.tap(x,y);
const done=async()=>{ await p.keyboard.press('Enter'); await W(250); };
// 1. tap selects, tap again edits
let [x,y]=await center('a'); await T(x,y); await W(300); let s=await st();
ok('tap selects the node (no editor yet)',s.sel==='a'&&!s.editing,JSON.stringify(s));
ok('phone: floating ✏️ 編輯 bar appears over the selected node, ≥44px',await p.locator('.nodetb [data-act="edit"]').isVisible()&&(await p.locator('.nodetb [data-act="edit"]').boundingBox()).height>=44);
if(SHOTS) await p.screenshot({path:SHOTS+'/touch-selected.png'});
await W(700); /* a deliberate second tap, slower than a double tap */ await T(x,y); await W(300); s=await st();
ok('tap the selected node again → editor focused',s.editing&&s.focus==='editbox',JSON.stringify(s));
ok('editor focus happened inside the tap gesture (user activation active → Android shows the keyboard)',(await p.evaluate(()=>window.__focusLog.at(-1)))===true,JSON.stringify(await p.evaluate(()=>window.__focusLog)));
await W(400); ok('editor stays focused after the tap finishes (no focus steal by compat mouse events)',(await st()).focus==='editbox');
await p.keyboard.press('Control+a'); await p.keyboard.type('甲改'); await done();
ok('typed text is saved',await p.evaluate(()=>window.__mm.doc.root.c[0].t)==='甲改');
// 2. ✏️ button
[x,y]=await center('b'); await T(x,y); await W(300);
const eb=await p.locator('.nodetb [data-act="edit"]').boundingBox(); await T(eb.x+eb.width/2,eb.y+eb.height/2); await W(300); s=await st();
ok('✏️ 編輯 opens the editor with focus (inside the tap)',s.editing&&s.focus==='editbox'&&(await p.evaluate(()=>window.__focusLog.at(-1)))===true,JSON.stringify(s));
if(SHOTS) await p.screenshot({path:SHOTS+'/touch-editing.png'});
await p.keyboard.press('Control+a'); await p.keyboard.type('乙改'); await done();
ok('✏️ edit saved',await p.evaluate(()=>window.__mm.doc.root.c[1].t)==='乙改');
// 3. double tap on an unselected node
[x,y]=await center('c'); await T(x,y); await W(90); await T(x,y); await W(400); s=await st();
ok('double tap an unselected node → editor',s.editing&&s.focus==='editbox',JSON.stringify(s)); await p.keyboard.press('Escape'); await W(200);
// 4. IME on a selected node (keyboard attached / desktop-style): keyCode 229 then composition
[x,y]=await center('c'); await T(x,y); await W(300); s=await st(); if(s.editing){ await p.keyboard.press('Escape'); await W(200); }
await p.evaluate(()=>document.querySelector('#cv').focus());
const cdp=await ctx.newCDPSession(p);
await cdp.send('Input.dispatchKeyEvent',{type:'rawKeyDown',windowsVirtualKeyCode:229,nativeVirtualKeyCode:229,key:'Process',code:'KeyJ'}); await W(100);
s=await st(); ok('IME keydown (keyCode 229) on a selected node opens an empty editor, no preventDefault',s.editing&&s.focus==='editbox'&&await p.evaluate(()=>document.querySelector('.editbox').value)==='',JSON.stringify(s));
await cdp.send('Input.imeSetComposition',{text:'ㄓㄨㄥ',selectionStart:3,selectionEnd:3}); await W(80);
await cdp.send('Input.imeSetComposition',{text:'中',selectionStart:1,selectionEnd:1}); await W(80);
await cdp.send('Input.insertText',{text:'中文'}); await W(150);
ok('composition lands in the editor intact',await p.evaluate(()=>document.querySelector('.editbox')&&document.querySelector('.editbox').value)==='中文',await p.evaluate(()=>document.querySelector('.editbox')&&document.querySelector('.editbox').value));
// Enter while composing must not commit (keyCode 229 Enter)
await cdp.send('Input.imeSetComposition',{text:'ㄗ',selectionStart:1,selectionEnd:1});
await cdp.send('Input.dispatchKeyEvent',{type:'rawKeyDown',windowsVirtualKeyCode:229,key:'Process',code:'Enter'}); await W(100);
ok('Enter during composition does not close the editor',(await st()).editing);
await cdp.send('Input.insertText',{text:'字'}); await W(100); await done();
ok('IME text saved',await p.evaluate(()=>window.__mm.doc.root.c[2].t)==='中文字',await p.evaluate(()=>window.__mm.doc.root.c[2].t));
// 5. long-press still opens the node menu, not the editor
[x,y]=await center('a'); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]}); await W(750); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await W(300);
ok('long-press opens the node menu (no editor)',await p.locator('.lpmenu').count()===1&&!(await st()).editing);
ok('no page errors',!errs.length,errs.join(' | '));
await b.close();
const n=res.filter(Boolean).length; console.log(`${n}/${res.length} passed`); process.exit(n===res.length?0:1);
