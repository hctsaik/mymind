// Faithful-import look (root.gs) for the 經典蜜桃 engine: per-level styles, branch palette, wrapped paragraph width,
// full-width CJK punctuation, priority badge size, underline nodes, arc and tapered connectors, stickers above the text,
// the source app's relationship line, collapsed-branch expanders, and the map's own canvas colour / background image in the app.
// All content here is synthetic. Run: BASE=http://localhost:8765/ node tests/classic-gs.mjs
import { chromium } from 'playwright-core';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const BASE=process.env.BASE||'http://localhost:8765/';
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const svgUri=(c)=>'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${c}"/></svg>`).toString('base64');
let k=0; const N=(t,c,x={})=>({id:'g'+(++k),t,...x,...(c?{c}:{})});
const long='一二三四五六七八九十一二三四五六七八九十'; // 20 × 14px = 280px > 200px limit
const root=N('中心',[
  N('甲',[N(long),N('「」。'),N('圖',null,{gst:{k:'st:a',w:40,h:40}}),N('收',[N('藏')],{collapsed:true})],{pri:1}),
  N('乙',[N('子'),N('丑')])]);
root.gs={v:1,bg:'#f5f9fc',bgImg:svgUri('#eef4fa'),maxW:200,layout:'right',keepNbsp:true,
  lv:[{fs:20,fw:'bold',color:'#ffffff',fill:'#3a7bd5',stroke:'transparent',sw:0,r:6,shape:'rect',pad:[10,20],m:[40],conn:'arc',cc:'#3a7bd5',cw:3,tap:true,tapW:10,align:'center',lh:1.2},
      {fs:16,fw:'normal',color:'#333333',fill:'transparent',stroke:'#999999',sw:2,r:0,shape:'underline',pad:[6,9],m:[20],conn:'arc',cc:'#999999',cw:2,align:'left',lh:1.2},
      {fs:14,fw:'normal',color:'#333333',fill:'transparent',stroke:'transparent',sw:0,r:5,shape:'rect',pad:[6,9],m:[16],conn:'arc',cc:'#999999',cw:2,align:'left',lh:1.2}],
  multi:{pal:['#e64248','#2bcc5b'],fill:false,conn:true},assets:{'st:a':svgUri('#ff9900')}};
const idOf=(n,t)=>n.t===t?n.id:(n.c||[]).map(c=>idOf(c,t)).find(Boolean);
root.rels=[{id:'r1',a:idOf(root,'甲'),b:idOf(root,'丑'),label:'',gm:{p0:[10,-10],c1:[40,-40],c2:[-40,-40],p3:[-10,-10],color:'#623f35',w:2,dash:'8 2',ms:false,me:true}}];
const doc={format:'mymind/1',id:'gs1',theme:'classic',settings:{layout:'right'},icon:'🧠',created:'2026-11-01T00:00:00Z',updated:'2026-11-20T00:00:00Z',root};
const b=await chromium.launch({executablePath:exe});
{ const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'tests/classic-render.html'); await p.waitForFunction(()=>window.ready); await p.evaluate(t=>window.fontsReady(t),'中心甲乙子丑圖收藏「」。'+long);
  const r=await p.evaluate(d=>{ const o=window.renderDoc(d,100,300,1); return {...o,svg:document.getElementById('vp').innerHTML,bg:document.getElementById('s').style.background}; },doc);
  const by=Object.fromEntries(r.nodes.map(n=>[n.t,n])), near=(a,b,e=.05)=>Math.abs(a-b)<=e;
  ok('a wrapped paragraph fills the whole text width limit (200 + 2×9)',near(by[long].w,218),by[long].w);
  ok('wrapped paragraph: two lines tall',near(by[long].h,2*16.796875+12,.01),by[long].h);
  ok('CJK punctuation keeps its full em box (「」。 = 3 × 14px + 18)',near(by['「」。'].w,60),by['「」。'].w);
  ok('priority badge scales with the font: 19px + 5px gap at 16px',near(by['甲'].w,16+19+5+18,.3),by['甲'].w);
  ok('sticker sits above the text: 40 + round(14/2) + one line + 2×6',near(by['圖'].h,40+7+16.796875+12,.01)&&near(by['圖'].w,40+18,.01),by['圖'].w+'×'+by['圖'].h);
  ok('sticker drawn from the map\'s own asset',/<image[^>]+href="data:image\/svg\+xml;base64/.test(r.svg));
  ok('underline nodes: a bottom line in the branch colour, no box',/d="M[-\d.]+ [-\d.]+ L[-\d.]+ [-\d.]+" stroke="#e64248" stroke-width="2" fill="none"/.test(r.svg),'');
  ok('branch palette: second main branch uses the second colour',r.svg.includes('#2bcc5b'));
  ok('arc connectors (elliptical arc segments)',/ A[\d.]+ [\d.]+ 0 0 [01] /.test(r.svg));
  ok('tapered root branches are filled shapes',/data-g="edge" d="M[^"]+Z?" fill="#e64248" stroke="none"/.test(r.svg));
  ok('collapsed branch is not laid out',!r.nodes.some(n=>n.t==='藏'));
  const A=by['甲'], B=by['丑'], q=v=>String(Math.round(v*1000)/1000);
  ok('relationship line: the source app\'s dashed cubic between the two node centres',r.svg.includes(`d="M${q(A.x+10)} ${q(A.y-10)} C${q(A.x+40)} ${q(A.y-40)} ${q(B.x-40)} ${q(B.y-40)} ${q(B.x-10)} ${q(B.y-10)}"`)&&/stroke-dasharray="8 2"/.test(r.svg)&&/marker-end="url\(#gmra-r1\)"/.test(r.svg),(r.svg.match(/<path data-g="rel"[^>]*>/)||[''])[0]);
  ok('harness paints the map background image over its colour',/url\("data:image\/svg\+xml/.test(r.bg)&&/100% 100%/.test(r.bg));
  ok('no NaN anywhere',!/NaN/.test(r.svg)); ok('no page errors',!errs.length,errs.join(' | ')); await p.context().close(); }
{ const ctx=await b.newContext({viewport:{width:1440,height:900}}); await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.addInitScript(d=>{ if(sessionStorage.s) return; sessionStorage.s=1; localStorage.clear(); localStorage.setItem('mymind.prefs',JSON.stringify({mode:'local',sync:'local'})); localStorage.setItem('mymind.index',JSON.stringify([{id:d.id,title:d.root.t,icon:d.icon,theme:d.theme,updated:d.updated,created:d.created}])); localStorage.setItem('mymind.map.'+d.id,JSON.stringify(d)); },doc);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'?nosw#/map/gs1'); await p.waitForSelector('body[data-ready="1"]'); await W(900);
  const st=()=>p.evaluate(()=>{ const cv=document.querySelector('#cv'); return {n:document.querySelectorAll('#mapsvg g.node').length, cv:cv.style.getPropertyValue('--cv').trim(), dot:cv.style.getPropertyValue('--cvdot').trim(), img:getComputedStyle(cv).backgroundImage.slice(0,30), exp:document.querySelectorAll('#ovl circle, #mapsvg circle').length}; });
  let s=await st();
  ok('app: map opens with its own canvas colour, dots hidden, background image shown',s.cv==='#f5f9fc'&&s.dot==='#f5f9fc'&&/url\("data:image/.test(s.img),JSON.stringify(s));
  ok('app: all visible nodes drawn',s.n===9,JSON.stringify(s));
  await p.evaluate(()=>{ const e=[...document.querySelectorAll('[data-act="style"]')].find(e=>e.offsetParent); e&&e.click(); }); await W(300);
  await p.click('[data-act="theme"][data-v="coral"]'); await W(400); s=await st();
  ok('app: another theme drops the imported background and colour',!/url\(/.test(s.img)&&s.cv!=='#f5f9fc',JSON.stringify(s));
  await p.click('[data-act="theme"][data-v="classic"]'); await W(400); s=await st();
  ok('app: back to 經典蜜桃 restores them',s.cv==='#f5f9fc'&&/url\("data:image/.test(s.img),JSON.stringify(s));
  ok('app: no page errors',!errs.length,errs.join(' | ')); await ctx.close(); }
await b.close();
const n=res.filter(Boolean).length; console.log(`${n}/${res.length} passed`); process.exit(n===res.length?0:1);
