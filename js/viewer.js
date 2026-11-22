// Read-only viewer for share links (view.html, v1.8). Same layout + renderer as the editor, so the map looks exactly as in
// the app; viewers can pan, zoom, fold/unfold branches and read notes, but nothing is saved and nothing can be edited.
import { I, esc, THEMES, DEFAULT_THEME } from './core.js';
import { layout, renderMap, allDeep, bounds } from './mapview.js';
import { loadShared, parseLink } from './share.js';
const $=s=>document.querySelector(s);
const isM=()=>innerWidth<=768;
const V={doc:null,vp:null,lay:null};
window.__mmv=V; // tests
const clone=o=>JSON.parse(JSON.stringify(o));
function theme(){ const T=THEMES[V.doc.theme]||THEMES[DEFAULT_THEME], g=V.doc.root.gs; return g&&g.bg&&T.engine==='classic'?{...T,canvas:g.bg}:T; }
const bgImg=()=>{ const T=THEMES[V.doc.theme]||THEMES[DEFAULT_THEME], g=V.doc.root.gs; return g&&g.bgImg&&T.engine==='classic'?`url("${g.bgImg}")`:''; };
const find=(n,id)=>n.id===id?n:(n.c||[]).reduce((a,c)=>a||find(c,id),null);
const fmt=iso=>{ try{ const d=new Date(iso); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }catch{ return ''; } };
function message(title,body){ document.body.dataset.ready='err'; $('#vw').innerHTML=`<div class="vwmsg" role="alert">${I('alert')}<h2>${esc(title)}</h2><p>${esc(body)}</p><a class="btn" href="./">認識 MyMind</a></div>`; }
function shell(){ const d=V.doc, T=theme();
  document.title=`${d.root.t} · MyMind（唯讀）`;
  $('#vw').innerHTML=`<div class="canvas" id="cv" style="--cv:${T.canvas};--cvdot:${T.canvas}" role="application" aria-roledescription="唯讀心智圖" aria-label="心智圖：${esc(d.root.t)}（唯讀）">
    <div class="stage" id="stage"><svg class="map" id="mapsvg" role="tree" aria-label="節點"><g id="vp"></g></svg></div></div>
   <header class="vwbar"><div class="vwtitle"><span class="ic" aria-hidden="true">${esc(d.icon||'🧠')}</span><div class="tt"><h1 id="vwt">${esc(d.root.t)}</h1><div class="meta"><span class="ro">${I('lock')}唯讀</span><span>快照 · ${esc(fmt(d.at))}</span></div></div></div></header>
   <a class="vwmade" href="./" target="_blank" rel="noopener">用 MyMind 製作</a>
   <div class="vwctl"><div class="vwgrp" role="group" aria-label="展開到第幾層"><span class="lbl">層級</span>${[1,2,3,0].map(l=>`<button data-a="level" data-v="${l}" aria-label="${l?'展開到第 '+l+' 層':'全部展開'}">${l||'全部'}</button>`).join('')}</div>
    <div class="vwgrp" role="group" aria-label="縮放"><button data-a="out" aria-label="縮小">${I('minus')}</button><span class="pct" id="pct" aria-live="polite">100%</span><button data-a="in" aria-label="放大">${I('plus')}</button><button data-a="fit" aria-label="符合畫面">${I('fit')}</button></div></div>`;
  const cv=$('#cv'), bi=bgImg(); if(bi){ cv.style.backgroundImage=bi; cv.style.backgroundSize='100% 100%'; cv.style.backgroundPosition='left bottom'; cv.style.backgroundRepeat='no-repeat'; }
  bind(); draw(); fit(true); }
function draw(){ const T=theme(), st=V.doc.settings||{}; V.lay=layout(clone(V.doc.root),T,st);
  const sc=V.vp?V.vp.sc:1, nodes=allDeep(V.lay).length; const {svg}=renderMap(V.lay,T,{sc,edge:st.edge,lw:st.lw,mobile:isM(),lod:sc<.45&&nodes>60}); $('#vp').innerHTML=svg;
  const by=new Map(allDeep(V.lay).map(n=>[n.id,n]));
  document.querySelectorAll('#mapsvg g.node').forEach(g=>{ const n=by.get(g.dataset.id); if(n&&((n.c&&n.c.length)||n.note||n.link)) g.classList.add('tapable'); });
  // links open in a new tab, never inside the viewer
  document.querySelectorAll('#mapsvg a[href]').forEach(a=>{ if(!/^https?:/i.test(a.getAttribute('href'))) a.removeAttribute('href'); });
  if(V.vp) apply(); }
function apply(){ const {tx,ty,sc}=V.vp; $('#vp').setAttribute('transform',`translate(${tx},${ty}) scale(${sc})`); const p=$('#pct'); if(p) p.textContent=Math.round(sc*100)+'%'; window.__VIEW=V.vp; }
function fit(first){ const st=$('#stage'), W=st.clientWidth, H=st.clientHeight, m=isM(), b=bounds(V.lay), top=m?80:76, bot=m?64:68, PAD=m?12:28;
  const aw=W-2*PAD, ah=H-top-bot; let sc=Math.min(1.2,aw/b.w,ah/b.h); const min=m?.42:.5;
  if(first&&sc<min){ // too big to read when fitted: open readable at the root, 符合畫面 shows everything
    sc=m?.6:.8; const r=V.lay; const left=r.layout==='balanced'||r.layout==='org'?W/2-r.x*sc:PAD-b.x0*sc; V.vp={sc,tx:left,ty:top+ah/2-r.y*sc}; return apply(); }
  sc=Math.max(.1,sc); V.vp={sc,tx:PAD+aw/2-(b.x0+b.w/2)*sc,ty:top+ah/2-(b.y0+b.h/2)*sc}; apply(); }
function zoomAt(f,cx,cy){ const st=$('#stage'); if(cx===undefined){cx=st.clientWidth/2;cy=st.clientHeight/2;} const v=V.vp, ns=Math.max(.1,Math.min(3,v.sc*f)), k=ns/v.sc; V.vp={sc:ns,tx:cx-(cx-v.tx)*k,ty:cy-(cy-v.ty)*k}; draw(); }
function toggle(id){ const n=find(V.doc.root,id); if(!n||!n.c||!n.c.length) return; const at=()=>{ const g=document.querySelector(`#mapsvg g.node[data-id="${CSS.escape(id)}"]`); const h=g&&(g.querySelector('rect.hit')||g); return h?h.getBoundingClientRect():null; };
  const r0=at(); n.collapsed=!n.collapsed; draw(); // keep the tapped node where it was (measured before the redraw replaces it)
  const r1=at(); if(r0&&r1&&r0.width){ V.vp={...V.vp,tx:V.vp.tx+(r0.x-r1.x),ty:V.vp.ty+(r0.y-r1.y)}; apply(); } closeSheet(); }
function setLevel(l){ (function w(n,d){ if(n.c&&n.c.length){ n.collapsed=!!(l&&d>=l); n.c.forEach(c=>w(c,d+1)); } })(V.doc.root,0); draw(); fit(); closeSheet(); }
function closeSheet(){ $('.vwsheet')?.remove(); }
function sheet(id){ const n=find(V.doc.root,id); if(!n) return; closeSheet(); const kids=n.c&&n.c.length; const link=n.link&&/^https?:\/\//i.test(n.link)?n.link:'';
  $('#vw').insertAdjacentHTML('beforeend',`<section class="vwsheet" role="dialog" aria-label="節點內容"><div class="hd"><h3>${esc(n.icon?n.icon+' ':'')}${esc(n.t)}</h3><button class="x" data-a="closeSheet" aria-label="關閉">${I('x')}</button></div>${n.note?`<p class="note">${esc(n.note)}</p>`:''}${link?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${I('link')}${esc(link)}</a>`:''}${kids?`<div class="acts"><button class="btn" data-a="toggle" data-v="${esc(n.id)}">${I(n.collapsed?'plus':'minus')}${n.collapsed?'展開子節點':'收合子節點'}</button></div>`:''}</section>`); }
function bind(){ const st=$('#stage'), pts=new Map(); let pan=null, pinch=null, down=null;
  const P=e=>{ const r=st.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
  st.addEventListener('pointerdown',e=>{ if(e.button===2) return; e.preventDefault(); st.setPointerCapture(e.pointerId); pts.set(e.pointerId,P(e));
    if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),c:[(a[0]+b[0])/2,(a[1]+b[1])/2]}; pan=null; down=null; return; }
    const [x,y]=P(e); const g=e.target.closest&&e.target.closest('g.node'); down={x,y,id:g&&g.dataset.id,cc:!!(e.target.closest&&e.target.closest('.cc')),link:e.target.closest&&e.target.closest('a[href]')}; pan={x0:x,y0:y,tx:V.vp.tx,ty:V.vp.ty,moved:false}; st.classList.add('panning'); });
  st.addEventListener('pointermove',e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,P(e)); const [x,y]=P(e);
    if(pinch&&pts.size===2){ const [a,b]=[...pts.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]), c=[(a[0]+b[0])/2,(a[1]+b[1])/2], v=V.vp, ns=Math.max(.1,Math.min(3,v.sc*d/pinch.d)), k=ns/v.sc; V.vp={sc:ns,tx:c[0]-(pinch.c[0]-v.tx)*k,ty:c[1]-(pinch.c[1]-v.ty)*k}; pinch={d,c}; apply(); return; }
    if(pan){ if(Math.hypot(x-pan.x0,y-pan.y0)>6) pan.moved=true; if(pan.moved){ V.vp={...V.vp,tx:pan.tx+x-pan.x0,ty:pan.ty+y-pan.y0}; apply(); } } });
  const end=e=>{ if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId); st.classList.remove('panning'); if(pinch){ if(pts.size<2){ pinch=null; draw(); } return; }
    const d=down, moved=pan&&pan.moved; pan=null; down=null; if(moved){ draw(); return; } if(!d||e.type==='pointercancel') return;
    if(d.link){ window.open(d.link.getAttribute('href'),'_blank','noopener'); return; }
    if(!d.id){ closeSheet(); return; } const n=find(V.doc.root,d.id); if(!n) return;
    if(d.cc) return toggle(d.id); if(n.note||n.link) return sheet(d.id); if(n.c&&n.c.length) return toggle(d.id); closeSheet(); };
  st.addEventListener('pointerup',end); st.addEventListener('pointercancel',end);
  st.addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('a')) e.preventDefault(); });
  st.addEventListener('wheel',e=>{ e.preventDefault(); const [x,y]=P(e); if(e.ctrlKey||e.metaKey) zoomAt(Math.exp(-e.deltaY*.01),x,y); else { V.vp={...V.vp,tx:V.vp.tx-(e.shiftKey?e.deltaY:e.deltaX),ty:V.vp.ty-(e.shiftKey?0:e.deltaY)}; apply(); } },{passive:false});
  addEventListener('keydown',e=>{ if(e.target.closest&&e.target.closest('input,textarea')) return; const k=e.key, s=60;
    if(k==='+'||k==='='){ zoomAt(1.2); } else if(k==='-'||k==='_'){ zoomAt(1/1.2); } else if(k==='0'){ fit(); } else if(k==='Escape'){ closeSheet(); }
    else if(/^Arrow/.test(k)){ V.vp={...V.vp,tx:V.vp.tx+(k==='ArrowLeft'?s:k==='ArrowRight'?-s:0),ty:V.vp.ty+(k==='ArrowUp'?s:k==='ArrowDown'?-s:0)}; apply(); } else return; e.preventDefault(); });
  let rt; addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(()=>draw(),120); });
  addEventListener('mm-classic-fonts',()=>draw());
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-a]'); if(!b) return; const a=b.dataset.a;
    if(a==='in') zoomAt(1.2); else if(a==='out') zoomAt(1/1.2); else if(a==='fit') fit(); else if(a==='level') setLevel(+b.dataset.v); else if(a==='closeSheet') closeSheet(); else if(a==='toggle') toggle(b.dataset.v); }); }
async function boot(){ const L=parseLink(location.hash);
  if(!L) return message('連結不完整','這個網址少了分享的內容。請向分享的人再要一次完整的連結（整段都要複製）。');
  try{ const d=await loadShared(L); V.doc=d; shell(); document.body.dataset.ready='1'; }
  catch(e){ document.body.dataset.ready='err';
    if(e.code==='offline') return message('沒有網路連線','連上網路後重新整理這個頁面。');
    if(e.code==='bad') return message('打不開這個分享',e.message);
    return message('這個分享已停止或不存在','分享的人可能已經停止分享，或連結不完整。請向對方再要一次連結。'); } }
addEventListener('hashchange',()=>location.reload());
boot();
