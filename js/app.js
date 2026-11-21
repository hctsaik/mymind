// MyMind app: state, routing, editor interactions, sync. Plain ES modules, no build step.
import { I, esc, THEMES, DEFAULT_THEME, readable, lum, cr, mix } from './core.js';
import { layout, renderMap, all, allDeep, kids, bounds, countDesc, colorOf } from './mapview.js';
import { prefs, secrets, maps, newId, storage } from './store.js';
import { client, GitHubError, blobSha } from './github.js';
import * as GD from './gdrive.js';
import { merge3, diffSummary } from './merge.js';
import * as AI from './ai.js';
import * as IO from './io.js';
import * as V from './views.js';
import { VERSION } from './version.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const P0=prefs.get();
const S={view:'list',filter:'all',q:'',sideQ:'',sort:'updated',mapId:null,doc:null,sel:null,panel:'',tab:'theme',outline:false,
  minimap:P0.minimap,hints:P0.hints,aibar:true,mode:P0.mode,syncMode:P0.sync,remote:false,unsynced:0,repo:P0.repo,model:P0.model,lines:P0.lines,
  sync:{state:'saved',at:null,msg:''},hist:{items:[],loading:false,error:''},preview:null,undo:[],redo:[],vp:null,dialog:null,editing:null};
window.__mm=S; // for tests/debugging (contains no secrets)
const ensureIds=n=>{if(!n.id)n.id=newId();(n.c||[]).forEach(ensureIds);return n;};
const clone=o=>JSON.parse(JSON.stringify(o));
function find(root,id,par=null,idx=0){ if(root.id===id) return {n:root,parent:par,idx}; for(let i=0;i<(root.c||[]).length;i++){const r=find(root.c[i],id,root,i); if(r) return r;} return null; }
const th=()=>THEMES[(S.doc&&S.doc.theme)||DEFAULT_THEME]||THEMES[DEFAULT_THEME];
const isM=V.isMobile;
let toastT;
function toast(msg,act){ let t=$('#toast'); if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t);}
  t.innerHTML=`<span>${esc(msg)}</span>${act?`<button class="btn" data-act="${act[1]}">${esc(act[0])}</button>`:''}`; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),act?8000:3500); }
// ---------- UI prefs ----------
function applyUi(){ const p=prefs.get(); const dark=p.ui==='dark'||(p.ui==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.ui=dark?'dark':'light'; document.documentElement.classList.toggle('reduce-motion',!!p.reduceMotion); S.lines=p.lines; }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{applyUi();render();});
// ---------- documents ----------
function newDoc(root,theme=DEFAULT_THEME){ const now=new Date().toISOString(); const id=newId(); ensureIds(root);
  return {format:'mymind/1',id,theme,settings:{},icon:'🧠',created:now,updated:now,root}; }
function metaFrom(doc,extra={}){ return {title:doc.root.t,icon:doc.icon,theme:doc.theme,updated:doc.updated,created:doc.created,star:!!doc.star,trashed:!!doc.trashed,trashedAt:doc.trashedAt||null,...extra}; }
function storeDoc(doc,{dirty=true}={}){ maps.save(doc.id,doc); maps.setMeta(doc.id,metaFrom(doc,dirty?{dirty:true}:{})); }
function createMap(root,{open=true,theme}={}){ const doc=newDoc(root,theme); storeDoc(doc); changed(); askPersist(); if(open) location.hash='#/map/'+doc.id; return doc; }
// ---------- mutations / undo ----------
function mutate(fn,{select,keepRedo}={}){ if(!S.doc||S.preview) return; S.undo.push(JSON.stringify(S.doc.root)); if(S.undo.length>200)S.undo.shift(); if(!keepRedo)S.redo=[];
  fn(S.doc.root); if(select!==undefined) S.sel=select; touch(); }
function touch(){ S.doc.updated=new Date().toISOString(); storeDoc(S.doc); S.sync.state=remote()?'dirty':'saved'; changed(); drawAll(); }
function undo(){ if(!S.undo.length) return toast('沒有可以復原的動作'); S.redo.push(JSON.stringify(S.doc.root)); S.doc.root=JSON.parse(S.undo.pop()); if(S.sel&&!find(S.doc.root,S.sel)) S.sel=S.doc.root.id; touch(); }
function redo(){ if(!S.redo.length) return toast('沒有可以重做的動作'); S.undo.push(JSON.stringify(S.doc.root)); S.doc.root=JSON.parse(S.redo.pop()); touch(); }
const selInfo=()=>S.doc&&S.sel?find(S.doc.root,S.sel):null;
function addChild(edit=true){ const f=selInfo()||{n:S.doc.root}; const n={id:newId(),t:'新主題'}; mutate(r=>{const x=find(r,f.n.id).n; x.c=x.c||[]; x.collapsed=false; x.c.push(n);},{select:n.id}); if(edit) startEdit(n.id,true); }
function addSibling(edit=true){ const f=selInfo(); if(!f||!f.parent) return addChild(edit); const n={id:newId(),t:'新主題'}; mutate(r=>{const p=find(r,f.parent.id).n; p.c.splice(find(r,f.n.id).idx+1,0,n);},{select:n.id}); if(edit) startEdit(n.id,true); }
function outdent(){ const f=selInfo(); if(!f||!f.parent) return; const gp=find(S.doc.root,f.parent.id); if(!gp.parent) return toast('第一層節點不能再升一層');
  mutate(r=>{const a=find(r,f.n.id), p=find(r,f.parent.id); p.n.c.splice(a.idx,1); if(!p.n.c.length) delete p.n.c; p.parent.c.splice(p.idx+1,0,a.n);}); }
function removeSel(){ const f=selInfo(); if(!f) return; if(!f.parent) return toast('中心主題不能刪除'); const next=(f.parent.c[f.idx+1]||f.parent.c[f.idx-1]||f.parent).id;
  mutate(r=>{const a=find(r,f.n.id); a.parent.c.splice(a.idx,1); if(!a.parent.c.length) delete a.parent.c;},{select:next}); toast('已刪除「'+f.n.t+'」',['復原','undo']); }
function moveNode(id,targetId,where){ if(id===targetId) return; const r0=S.doc.root, src=find(r0,id); if(!src||!src.parent) return; const tgt=find(r0,targetId); if(!tgt) return; if(find(src.n,targetId)) return toast('不能移到自己的子節點底下');
  if(where!=='child'&&!tgt.parent) where='child';
  mutate(r=>{const a=find(r,id); a.parent.c.splice(a.idx,1); if(!a.parent.c.length) delete a.parent.c; const t=find(r,targetId);
    if(where==='child'){t.n.c=t.n.c||[]; t.n.collapsed=false; t.n.c.push(a.n);} else {const i=find(r,targetId).idx; t.parent.c.splice(where==='before'?i:i+1,0,a.n);}},{select:id}); }
function reorder(dir){ const f=selInfo(); if(!f||!f.parent) return; const j=f.idx+dir; if(j<0||j>=f.parent.c.length) return; mutate(r=>{const p=find(r,f.parent.id).n; const [x]=p.c.splice(f.idx,1); p.c.splice(j,0,x);}); }
function toggleCollapse(id){ const f=id?find(S.doc.root,id):selInfo(); if(!f||!f.n.c||!f.n.c.length) return; mutate(r=>{const x=find(r,f.n.id).n; x.collapsed=!x.collapsed;}); }
function setLevel(l){ mutate(r=>{(function w(n,d){ if(n.c&&n.c.length){ n.collapsed=!!(l&&d>=l); n.c.forEach(c=>w(c,d+1)); } })(r,0);}); }
function setField(k,v){ const f=selInfo(); if(!f) return toast('先選一個節點'); mutate(r=>{const x=find(r,f.n.id).n; if(v===undefined||v===''||v===0||v===false||v==='none') delete x[k]; else x[k]=v;}); }
// ---------- routing ----------
function route(){ const h=location.hash.replace(/^#\/?/,''); const [a,b]=h.split('/');
  if(!S.mode){ S.view='welcome'; return render(); }
  if(a==='map'&&b){ const d=maps.load(b); if(!d){ toast('找不到這張圖'); location.hash='#/'; return; } openDoc(d); return; }
  S.view='list'; S.filter=['starred','recent','trash'].includes(a)?a:'all'; closeDoc(); render(); }
function openDoc(d){ if(S.mapId!==d.id){ S.undo=[];S.redo=[];S.preview=null;S.vp=null;S.panel=S.panel==='history'?'':S.panel; S.sel=d.root.id; S.outline=false; S.find=null; }
  if(S.mapId!==d.id&&remote()&&Date.now()-(S.lastOpenPull||0)>20000){ S.lastOpenPull=Date.now(); setTimeout(()=>syncNow({push:false,reason:'open'}),0); } // pull on open: pick up edits from other devices
  S.view='editor'; S.mapId=d.id; S.doc=d; maps.setMeta(d.id,{opened:new Date().toISOString()}); const m=maps.meta(d.id); if(S.sync.state!=='error'&&S.sync.state!=='offline') S.sync.state=m&&m.dirty&&remote()?'dirty':'saved'; render(); }
function closeDoc(){ S.find=null; S.doc=null; S.mapId=null; S.editing=null; }
// ---------- rendering ----------
let shellKey='';
function render(){ applyUi(); syncInfo(); const side=$('#side'), main=$('#main'); const app=$('#app');
  if(S.view==='welcome'){ app.classList.add('nosidebar'); side.innerHTML=''; main.innerHTML=V.welcome(); shellKey=''; $('#skip').href='#content'; $('#skip').textContent='跳到內容'; drawDialog(); return; }
  app.classList.remove('nosidebar'); side.innerHTML=V.sidebar(S,maps.index());
  if(S.view==='list'){ shellKey=''; main.innerHTML=V.home(S,maps.index(),id=>maps.load(id)); $('#skip').href='#content'; $('#skip').textContent='跳到內容'; }
  else if(S.view==='editor'){ $('#skip').href='#cv'; $('#skip').textContent='跳到畫布';
    const key=[S.mapId,S.panel,S.outline,isM(),S.minimap,S.hints,S.aibar,!!S.preview].join('|');
    if(key!==shellKey){ main.innerHTML=V.editorShell(S,S.doc,curName()); main.style.setProperty('--cv-main',th().canvas); shellKey=key; bindStage(); drawAll(true); }
    else drawAll(); }
  drawDialog(); }
const curName=()=>{const f=selInfo();return (f?f.n:S.doc.root).t;};
function drawChrome(){ syncInfo(); if(S.view!=='editor'){ const side=$('#side'); if(side&&S.view==='list'&&!side.contains(document.activeElement)) side.innerHTML=V.sidebar(S,maps.index()); $$('.syncbtn').forEach(b=>b.outerHTML=V.syncBtn(S,b.dataset.k)); return; } $$('.syncbtn').forEach(b=>b.outerHTML=V.syncBtn(S,b.dataset.k)); const t=$('#maptitle'); if(t) t.textContent=(S.doc.icon||'🧠')+' '+S.doc.root.t; const sv=$('.top .saved'); if(sv) sv.outerHTML=V.savedChip(S); const mb=$('.top .rb.more'); if(mb&&!mb.matches('[aria-expanded=true]')) mb.outerHTML=V.moreBtn(S); $$('.mstat').forEach(x=>x.remove()); $('.top.flt')?.insertAdjacentHTML('afterend',V.mobileStatus(S));
  const bp=$('.backpill'); if(bp){bp.querySelector('.cn').textContent=curName(); bp.setAttribute('aria-label','回到列表（目前節點：'+curName()+'）');}
  $('#cv').style.setProperty('--cv',th().canvas); $('#main').style.setProperty('--cv-main',th().canvas);
  const side=$('#side'); if(side&&!side.contains(document.activeElement)) side.innerHTML=V.sidebar(S,maps.index()); }
function drawPanel(){ const h=$('#panelHost'); if(!h) return; const f=selInfo();
  const key=S.panel+'|'+S.sel+'|'+(S.panelRev||0);
  if(h.dataset.k===key&&S.panel==='note') return; // keep textarea focus while typing
  const html=S.panel==='style'?V.stylePanel(S,S.doc,f&&f.n):S.panel==='history'?V.historyPanel(S):S.panel==='note'&&f?V.notePanel(f.n,{doc:S.doc,allTags:allTags(),linkErr:S.linkErr,imgErr:S.imgErr}):'';
  const focusId=document.activeElement&&h.contains(document.activeElement)?document.activeElement.dataset.act+'|'+(document.activeElement.dataset.v||''):null;
  h.innerHTML=html; h.dataset.k=key;
  if(focusId){const [a,v]=focusId.split('|'); const el=h.querySelector(`[data-act="${a}"]${v?`[data-v="${CSS.escape(v)}"]`:''}`); if(el) el.focus();} }
function drawAll(first){ if(S.view!=='editor'||!S.doc) return; drawChrome(); drawPanel();
  const oh=$('#outlineHost'); if(oh){ const ae=document.activeElement, keep=S.olFocus||(ae&&ae.classList&&ae.classList.contains('olin')?{id:ae.dataset.olid,pos:ae.selectionStart}:null); S.olFocus=null; const sy=oh.firstElementChild?oh.firstElementChild.scrollTop:0;
    oh.innerHTML=S.outline?V.outlineView((S.preview?S.preview.doc:S.doc).root,S):''; if(S.outline&&oh.firstElementChild) oh.firstElementChild.scrollTop=sy; if(S.outline&&keep) olFocus(keep.id,keep.pos); }
  applyInsets(); drawMap(first); }
function applyInsets(){ const cv=$('#cv'), st=$('#stage'); if(!cv) return; const R=cv.getBoundingClientRect(), ins={top:0,right:0,bottom:0,left:0}, G=8;
  cv.querySelectorAll('[data-dock]').forEach(e=>{ e.getAnimations({subtree:true}).forEach(a=>a.finish()); const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden') return; const r=e.getBoundingClientRect(); if(r.width<1||r.height<1) return;
    const d=e.dataset.dock; if(d==='bottom') ins.bottom=Math.max(ins.bottom,R.bottom-r.top+G); else if(d==='right') ins.right=Math.max(ins.right,R.right-r.left+G); else if(d==='top') ins.top=Math.max(ins.top,r.bottom-R.top+G); else ins.left=Math.max(ins.left,r.right-R.left+G); });
  if(isM()) ins.top=Math.max(ins.top,0);
  st.style.inset=`${ins.top}px ${ins.right}px ${ins.bottom}px ${ins.left}px`; S.safe=ins; window.__SAFE=ins; }
function laidOut(){ const doc=S.preview?S.preview.doc:S.doc; const r=layout(clone(doc.root),th(),doc.settings||{}); const by=new Map(); allDeep(r).forEach(n=>by.set(n.id,n)); return {r,by}; }
function initialView(r){ const st=$('#stage'), W=st.clientWidth, H=st.clientHeight, m=isM(), b=bounds(r), PAD=m?16:28, big=all(r).length>120;
  if(r.layout==='balanced'||r.layout==='org'){ const sc=Math.max(m?.62:.5,Math.min(1,(W-2*PAD)/b.w,(H-2*PAD)/b.h)); const tx=b.w*sc<=W-2*PAD?W/2-(b.x0+b.w/2)*sc:W/2-r.x*sc;
    let ty=r.layout==='org'?(b.h*sc<=H-2*PAD?H/2-(b.y0+b.h/2)*sc:PAD-b.y0*sc):(b.h*sc<=H-2*PAD?H/2-(b.y0+b.h/2)*sc:H/2-r.y*sc);
    // phone + org chart wider than the screen: start at the top-left (first branch and the root in view), pan right for more
    if(m&&r.layout==='org'&&b.w*sc>W-2*PAD) return {sc,tx:Math.min(PAD-b.x0*sc,W-PAD-(r.x+r.w/2)*sc),ty:84-b.y0*sc}; return {tx,ty,sc}; }
  const L1=[r,...kids(r)], l1={x1:Math.max(...L1.map(n=>n.x+n.w/2)),y0:Math.min(...L1.map(n=>n.y-n.h/2)),y1:Math.max(...L1.map(n=>n.y+n.h/2))}; let sc,tx,ty;
  if(big){ sc=m?Math.max(.5,Math.min(.72,(W-2*PAD)/(l1.x1-b.x0))):Math.max(.7,Math.min(1,(W-2*PAD)/b.w)); tx=PAD-b.x0*sc; ty=((S.doc.settings||{}).rootTop??th().rootTop)?PAD-b.y0*sc:H*.45-r.y*sc; }
  else if(m){ sc=Math.max(.5,Math.min(1,(W-2*PAD)/(l1.x1-b.x0),(H-2*PAD)/(l1.y1-l1.y0))); tx=PAD-b.x0*sc; if(b.w*sc<=W-2*PAD) tx=W/2-(b.x0+b.w/2)*sc; ty=H/2-((l1.y0+l1.y1)/2)*sc; if(b.h*sc<=H-2*PAD) ty=H/2-(b.y0+b.h/2)*sc; }
  else { sc=Math.min(1,(W-2*PAD)/b.w,(H-2*PAD)/b.h); sc=Math.max(sc,.35); tx=W/2-(b.x0+b.w/2)*sc; ty=H/2-(b.y0+b.h/2)*sc; if(b.h*sc>H-2*PAD) ty=H/2-r.y*sc; }
  return {tx,ty,sc}; }
let lay=null;
function drawMap(first){ const vp=$('#vp'); if(!vp) return; lay=laidOut(); const doc=S.preview?S.preview.doc:S.doc;
  if(!S.vp||first&&!S.vp) S.vp=initialView(lay.r); if(first&&S.vpFor!==S.mapId){S.vp=initialView(lay.r);S.vpFor=S.mapId;}
  const lod=S.vp.sc<.45&&all(lay.r).length>60;
  if(S.find){ S.find.hits=findHits(); if(S.find.i>=S.find.hits.length) S.find.i=0; }
  const {svg,b}=renderMap(lay.r,th(),{hits:S.find&&S.find.hits.length?new Set(S.find.hits):null,cur:S.find&&S.find.hits[S.find.i],sel:S.preview?null:S.sel,lightLines:S.lines==='light',sc:S.vp.sc,edge:(doc.settings||{}).edge,lw:(doc.settings||{}).lw,mobile:isM(),drop:S.drop,lod});
  vp.innerHTML=svg; S.bounds=b; applyVp(); drawOverview(lod); drawMinimap(svg,b);
  $$('.levels button').forEach(x=>x.setAttribute('aria-pressed','false')); }
function applyVp(){ const vp=$('#vp'); if(!vp) return; const {tx,ty,sc}=S.vp; vp.setAttribute('transform',`translate(${tx},${ty}) scale(${sc})`); const p=$('#pct'); if(p) p.textContent=Math.round(sc*100)+'%'; window.__VIEW=S.vp; positionEditor(); updateMinimapVp(); }
function drawOverview(lod){ const o=$('#ovl'); if(!o) return; o.querySelectorAll('.ovchip').forEach(e=>e.remove()); if(!lod) return; const T=th(), {tx,ty,sc}=S.vp;
  all(lay.r).filter(n=>n.d<=1).forEach(n=>{const c=n.d===0?T.root:colorOf(n,T); let fg=n.d===0?T.rootText:'#1F2329'; let cc=c;
    if(n.d===1&&cr('#FFFFFF',c)>=4.5) fg='#FFFFFF'; else if(n.d===1&&T.l1!=='tag'&&lum(c)<.3){ for(let t=0;cr('#FFFFFF',cc)<4.6&&t<=1;t+=.04) cc=mix(c,'#000000',t); fg='#FFFFFF'; }
    if(n.d===1&&T.l1==='tag') fg='#3B2A20'; fg=readable(fg,cc,4.5);
    o.insertAdjacentHTML('beforeend',`<span class="ovchip ${n.d===0?'r':''}" data-g="chip" style="left:${tx+(n.d===0?n.x+n.w/2:n.x-n.w/2)*sc}px;top:${ty+n.y*sc}px;background:${cc};color:${fg};box-shadow:inset 0 0 0 1.5px ${S.lines==='light'?cc:readable(cc,T.canvas,3)}">${esc(n.t)}</span>`);}); }
function drawMinimap(svg,b){ const mm=$('#mmsvg'); if(!mm||!S.minimap||isM()) return; mm.setAttribute('viewBox',`${b.x0-30} ${b.y0-30} ${b.w+60} ${b.h+60}`); mm.innerHTML=svg; updateMinimapVp(); }
function updateMinimapVp(){ const mm=document.querySelector('.minimap'), vp=$('#mmvp'), st=$('#stage'); if(!mm||!vp||!S.bounds||!mm.clientWidth) return; const b=S.bounds, vbx=b.x0-30,vby=b.y0-30,vbw=b.w+60,vbh=b.h+60, MW=mm.clientWidth,MH=mm.clientHeight,k=Math.min(MW/vbw,MH/vbh),ox=(MW-vbw*k)/2,oy=(MH-vbh*k)/2, {tx,ty,sc}=S.vp;
  let L=ox+(-tx/sc-vbx)*k,T=oy+(-ty/sc-vby)*k,R=L+st.clientWidth/sc*k,B=T+st.clientHeight/sc*k; L=Math.max(2,L);T=Math.max(2,T);R=Math.min(MW-2,R);B=Math.min(MH-2,B); Object.assign(vp.style,{left:L+'px',top:T+'px',width:Math.max(8,R-L)+'px',height:Math.max(8,B-T)+'px'}); }
let zoomT;
function zoomAt(f,cx,cy){ const st=$('#stage'); if(cx===undefined){cx=st.clientWidth/2;cy=st.clientHeight/2;} const v=S.vp, ns=Math.max(.15,Math.min(3,v.sc*f)), k=ns/v.sc;
  S.vp={sc:ns,tx:cx-(cx-v.tx)*k,ty:cy-(cy-v.ty)*k}; applyVp(); clearTimeout(zoomT); zoomT=setTimeout(()=>drawMap(),140); }
function fit(){ const r=lay.r, st=$('#stage'), b=bounds(r), PAD=isM()?16:28; const sc=Math.max(.15,Math.min(1.2,(st.clientWidth-2*PAD)/b.w,(st.clientHeight-2*PAD)/b.h)); S.vp={sc,tx:st.clientWidth/2-(b.x0+b.w/2)*sc,ty:st.clientHeight/2-(b.y0+b.h/2)*sc}; drawMap(); }
function ensureVisible(id){ const n=lay&&lay.by.get(id), st=$('#stage'); if(!n||!st) return; const {tx,ty,sc}=S.vp, x0=tx+(n.x-n.w/2)*sc, x1=tx+(n.x+n.w/2+40)*sc, y0=ty+(n.y-n.h/2)*sc, y1=ty+(n.y+n.h/2)*sc, W=st.clientWidth, H=st.clientHeight, M=24; let dx=0,dy=0;
  if(x1>W-M) dx=W-M-x1; if(x0+dx<M) dx=M-x0; if(y1>H-M) dy=H-M-y1; if(y0+dy<M) dy=M-y0; if(dx||dy){S.vp={...S.vp,tx:tx+dx,ty:ty+dy}; applyVp();} }
// ---------- v1.4: outline editing, node details, icons, images ----------
const allTags=()=>S.doc?[...new Set(allDeep(S.doc.root).flatMap(n=>Array.isArray(n.tags)?n.tags:(n.tag?[n.tag]:[])))]:[];
const tagsOfN=n=>Array.isArray(n.tags)?n.tags:(n.tag?[n.tag]:[]);
function olFocus(id,pos){ const el=document.querySelector(`.olin[data-olid="${CSS.escape(id)}"]`); if(!el) return; el.focus({preventScroll:false}); const p=pos==null?el.value.length:Math.min(pos,el.value.length); try{ el.setSelectionRange(p,p); }catch{} el.scrollIntoView({block:'nearest'}); S.olId=id; $$('.olr.cur').forEach(r=>r.classList.remove('cur')); el.closest('.olr')?.classList.add('cur'); }
function quietSave(){ S.doc.updated=new Date().toISOString(); storeDoc(S.doc); S.sync.state=remote()?'dirty':'saved'; changed(); drawChrome(); }
let olT;
function olVisible(){ return $$('.olin').map(e=>e.dataset.olid); }
function olOp(op,id=S.olId){ if(!S.doc||S.preview||!id) return; const f=find(S.doc.root,id); if(!f) return; let focus=id, pos=null;
  if(op==='add'){ const n={id:newId(),t:''}; mutate(r=>{ const g=find(r,id); if(!g.parent||(g.n.c&&g.n.c.length&&!g.n.collapsed)){ g.n.c=g.n.c||[]; g.n.c.unshift(n); delete g.n.collapsed; } else g.parent.c.splice(g.idx+1,0,n); },{select:n.id}); focus=n.id; }
  else if(op==='indent'){ if(!f.parent||f.idx===0) return toast('第一個子項目不能再縮排'); pos=$(`.olin[data-olid="${CSS.escape(id)}"]`)?.selectionStart; mutate(r=>{ const g=find(r,id), prev=g.parent.c[g.idx-1]; g.parent.c.splice(g.idx,1); prev.c=prev.c||[]; prev.c.push(g.n); delete prev.collapsed; }); }
  else if(op==='outdent'){ if(!f.parent||f.parent.id===S.doc.root.id) return toast(f.parent?'已經是第一層':'中心主題不能移動'); pos=$(`.olin[data-olid="${CSS.escape(id)}"]`)?.selectionStart; mutate(r=>{ const g=find(r,id), gp=find(r,g.parent.id); g.parent.c.splice(g.idx,1); gp.parent.c.splice(gp.idx+1,0,g.n); }); }
  else if(op==='up'||op==='down'){ if(!f.parent) return; const j=f.idx+(op==='up'?-1:1); if(j<0||j>=f.parent.c.length) return; pos=$(`.olin[data-olid="${CSS.escape(id)}"]`)?.selectionStart; mutate(r=>{ const g=find(r,id), a=g.parent.c; [a[g.idx],a[j]]=[a[j],a[g.idx]]; }); }
  else if(op==='del'){ if(!f.parent) return toast('中心主題不能刪除'); const vis=olVisible(), i=vis.indexOf(id); focus=vis[i-1]||f.parent.id; const cnt=allDeep(f.n).length; mutate(r=>{ const g=find(r,id); g.parent.c.splice(g.idx,1); },{select:focus}); if(cnt>1) toast(`已刪除 ${cnt} 個節點`,['復原','undo']); }
  S.sel=focus; S.olFocus={id:focus,pos}; drawAll(); }
function olKey(e,t){ const id=t.dataset.olid, c=e.ctrlKey||e.metaKey; if(e.isComposing||e.keyCode===229) return false;
  if(e.key==='Enter'){ e.preventDefault(); olOp('add',id); return true; }
  if(e.key==='Tab'){ e.preventDefault(); olOp(e.shiftKey?'outdent':'indent',id); return true; }
  if(e.key==='Backspace'&&t.value===''&&t.selectionStart===0){ e.preventDefault(); olOp('del',id); return true; }
  if((e.key==='ArrowUp'||e.key==='ArrowDown')&&(e.altKey||(c&&e.shiftKey))){ e.preventDefault(); olOp(e.key==='ArrowUp'?'up':'down',id); return true; }
  if((e.key==='ArrowUp'||e.key==='ArrowDown')&&!c&&!e.shiftKey){ e.preventDefault(); const v=olVisible(), i=v.indexOf(id), n=v[i+(e.key==='ArrowUp'?-1:1)]; if(n) olFocus(n,t.selectionStart); return true; }
  if(c&&(e.key==='z'||e.key==='Z'||e.key==='y')){ e.preventDefault(); S.olFocus={id,pos:t.selectionStart}; (e.key==='y'||e.shiftKey)?redo():undo(); return true; }
  if(c&&e.key==='.'){ e.preventDefault(); toggleCollapse(id); S.olFocus={id}; return true; }
  if(e.key==='Escape'){ e.preventDefault(); S.outline=false; S.sel=id; render(); ensureVisible(id); $('#cv')?.focus(); return true; }
  return false; }
function normLink(v){ v=String(v||'').trim(); if(!v) return ''; if(!/^[a-z][a-z0-9+.-]*:/i.test(v)) v='https://'+v; try{ const u=new URL(v); if(!/^https?:$/.test(u.protocol)||!u.hostname.includes('.')&&u.hostname!=='localhost') return null; return u.href; }catch{ return null; } }
function panelRefresh(){ S.panelRev=(S.panelRev||0)+1; drawPanel(); }
function addTag(v){ const f=selInfo(); if(!f) return; const t=String(v||'').trim().replace(/^#+/,'').replace(/\s+/g,'_').slice(0,24); if(!t) return; const cur=tagsOfN(f.n); if(cur.includes(t)) return toast('已經有這個標籤');
  mutate(r=>{ const x=find(r,f.n.id).n; x.tags=[...tagsOfN(x),t]; delete x.tag; }); panelRefresh(); setTimeout(()=>$('#tagin')?.focus(),0); }
const IMG_LIMIT=150*1024, IMG_SIDE=640;
async function shrinkImage(blob){ if(blob.size>8*1024*1024) throw new Error('圖片超過 8 MB，請先縮小'); const bm=await createImageBitmap(blob); const k=Math.min(1,IMG_SIDE/Math.max(bm.width,bm.height)); let w=Math.round(bm.width*k), h=Math.round(bm.height*k);
  for(let tries=0;tries<6;tries++){ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.fillStyle='#FFFFFF'; x.fillRect(0,0,w,h); x.drawImage(bm,0,0,w,h);
    for(const q of [.85,.72,.6]){ const url=c.toDataURL('image/jpeg',q); if(url.length*3/4<=IMG_LIMIT) return {src:url,w,h}; } w=Math.round(w*.8); h=Math.round(h*.8); }
  throw new Error('圖片太大，無法壓到 150 KB'); }
async function setImageFromBlob(id,blob){ try{ const img=await shrinkImage(blob); mutate(r=>{ const x=find(r,id); if(x) x.n.img=img; }); S.imgErr=''; panelRefresh(); toast(`已加入圖片（${Math.round(img.src.length*3/4/1024)} KB）`,['復原','undo']); }catch(e){ S.imgErr=e.message; panelRefresh(); toast(e.message); } }
function openIcons(){ const f=selInfo(); if(!f) return toast('先選一個節點'); openDialog({type:'emoji',nodeId:f.n.id,nodeT:f.n.t,cat:V.emojiCatOf(f.n.icon),q:'',focus:'#emgrid .emb[tabindex="0"]'}); }
// ---------- node search (v1.3) ----------
const norm=t=>String(t||'').normalize('NFKC').toLowerCase();
function findHits(){ const F=S.find, q=F&&norm(F.q.trim()); if(!q) return []; const doc=S.preview?S.preview.doc:S.doc; return allDeep(doc.root).filter(n=>norm(n.t).includes(q)||norm(n.note).includes(q)).map(n=>n.id); }
function openFind(){ if(S.view!=='editor'||!S.doc) return; if(S.editing) commitEdit(); closeMenu();
  if(!S.find){ S.find={q:'',i:0,hits:[]}; const cv=$('#cv'); if(cv&&!$('#findbar')) $('#outlineHost').insertAdjacentHTML('beforebegin',V.findbar(S)); $$('[data-act="find"]').forEach(b=>b.setAttribute('aria-pressed','true')); }
  const q=$('#findq'); if(q){ q.focus(); q.select(); } }
function closeFind(){ if(!S.find) return; S.find=null; $('#findbar')?.remove(); $$('[data-act="find"]').forEach(b=>b.setAttribute('aria-pressed','false')); drawMap(); $('#cv')?.focus({preventScroll:true}); }
function updateFindCount(){ const c=$('#findcount'); if(c) c.textContent=V.findCount(S.find); }
// open the node details panel, optionally scrolled to one section (phone: tap on a node's link icon)
function openDetails(sec){ if(!S.doc||!selInfo()) return; S.panel='note'; render(); setTimeout(()=>{ revealAboveSheet(S.sel); if(sec){ const el=$(`#panelHost .nsec[data-sec="${sec}"]`); const sc=el&&el.closest('.body,.pbody'); if(sc) sc.scrollTop+=el.getBoundingClientRect().top-sc.getBoundingClientRect().top-8; el?.querySelector('a,button,input')?.focus({preventScroll:true}); } },isM()?320:20); }
// mobile: keep the node visible in the strip between the top bar and the details sheet
function revealAboveSheet(id){ const n=lay&&lay.by.get(id), st=$('#stage'), sh=$('#panelHost .sheet'); if(n&&st&&!sh){ const ap=$('#panelHost .stylep'); if(!ap) return; const {sc}=S.vp, right=ap.getBoundingClientRect().left-st.getBoundingClientRect().left-24, x1=S.vp.tx+(n.x+n.w/2+40)*sc; if(x1>right){ S.vp={...S.vp,tx:S.vp.tx-(x1-right)}; drawMap(); } return; } if(!n||!st||!sh) return; const r=st.getBoundingClientRect(), top=70, bot=sh.getBoundingClientRect().top-r.top-8; if(bot-top<40) return; const {sc}=S.vp; const cy=S.vp.ty+n.y*sc, cx=S.vp.tx+n.x*sc;
  if(cy>top+n.h*sc/2&&cy<bot-n.h*sc/2&&cx-n.w*sc/2>0&&cx+n.w*sc/2<st.clientWidth) return; S.vp={sc,tx:st.clientWidth/2-n.x*sc,ty:n.h*sc>bot-top-16?top+8-(n.y-n.h/2)*sc:(top+bot)/2-n.y*sc}; drawMap(); }
function centerOn(id){ const n=lay&&lay.by.get(id), st=$('#stage'); if(!n||!st) return; const sc=S.vp.sc, top=isM()?70:56; S.vp={sc,tx:st.clientWidth/2-n.x*sc,ty:top+(st.clientHeight-top)/2-n.y*sc}; drawMap(); }
function goFind(i){ const F=S.find; if(!F) return; F.hits=findHits(); if(!F.hits.length){ updateFindCount(); drawMap(); return; } F.i=((i%F.hits.length)+F.hits.length)%F.hits.length; const id=F.hits[F.i];
  if(!S.preview){ let p=find(S.doc.root,id), opened=false; while(p&&p.parent){ if(p.parent.collapsed){ delete p.parent.collapsed; opened=true; } p=find(S.doc.root,p.parent.id); } if(opened) touch(); S.sel=id; }
  drawAll(); centerOn(id); updateFindCount(); }
function select(id,{scroll=true}={}){ S.sel=id; drawAll(); if(scroll) ensureVisible(id); }
// ---------- inline edit ----------
function startEdit(id,isNew){ if(S.preview) return; const n=lay&&lay.by.get(id); if(!n) { drawMap(); }
  S.editing={id,isNew,orig:find(S.doc.root,id).n.t}; ensureVisible(id); const o=$('#ovl'); o.querySelector('.editbox')?.remove();
  const ta=document.createElement('textarea'); ta.className='editbox'; ta.value=S.editing.orig; ta.setAttribute('aria-label','編輯節點文字（Enter 完成，Shift+Enter 換行，Esc 取消）'); ta.rows=1; o.appendChild(ta); positionEditor(); ta.focus(); ta.select();
  ta.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.isComposing||e.keyCode===229) return;
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();commitEdit();$('#cv').focus();}
    else if(e.key==='Escape'){e.preventDefault();cancelEdit();}
    else if(e.key==='Tab'){e.preventDefault();commitEdit();if(e.shiftKey)outdent();else addChild();} });
  ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});
  ta.addEventListener('blur',()=>setTimeout(()=>{ if(S.editing&&S.editing.id===id&&document.activeElement!==ta) commitEdit(); },0)); }
// phones: a small floating bar over the selected node — ✏️ 編輯 opens the editor from a real tap (keyboard shows), ⋯ the node menu
function drawNodeTb(){ const o=$('#ovl'); if(!o) return; let tb=o.querySelector('.nodetb'); const n=lay&&S.sel&&lay.by.get(S.sel);
  if(!isM()||!n||n.x===undefined||S.editing||S.preview||S.outline||S.view!=='editor'){ tb&&tb.remove(); return; }
  if(!tb){ o.insertAdjacentHTML('beforeend',`<div class="nodetb" role="toolbar" aria-label="選取的節點"><button class="btn" data-act="edit" aria-label="編輯文字">${I('edit')}<span>編輯</span></button><button class="btn" data-act="nodeMenuTb" aria-label="更多節點動作">${I('more')}</button></div>`); tb=o.querySelector('.nodetb'); }
  const {tx,ty,sc}=S.vp, cx=tx+n.x*sc, top=ty+(n.y-n.h/2)*sc, W=o.clientWidth||innerWidth, w=tb.offsetWidth||140; let x=Math.max(8,Math.min(W-w-8,cx-w/2)), y=top-54; if(y<64) y=ty+(n.y+n.h/2)*sc+10;
  tb.style.left=x+'px'; tb.style.top=y+'px'; }
function positionEditor(){ drawNodeTb(); const ta=document.querySelector('#ovl .editbox'); if(!ta||!S.editing||!lay) return; const n=lay.by.get(S.editing.id); if(!n) return; const {tx,ty,sc}=S.vp;
  const fs=n.d===0?22:n.d===1?16:14; Object.assign(ta.style,{left:(tx+(n.x-n.w/2)*sc)+'px',top:(ty+(n.y-n.h/2)*sc)+'px',minWidth:Math.max(120,n.w*sc)+'px',minHeight:(n.h*sc)+'px',fontSize:Math.max(14,fs*sc)+'px',fontWeight:n.d<=1?700:400}); }
function commitEdit(){ const ta=document.querySelector('#ovl .editbox'); if(!ta||!S.editing) return; const v=ta.value.trim()||S.editing.orig||'新主題'; const id=S.editing.id; const orig=S.editing.orig; S.editing=null; ta.remove();
  if(v!==orig){ S.undo.push('__skip'); S.undo.pop(); mutate(r=>{find(r,id).n.t=v;}); } else drawMap(); }
function cancelEdit(){ const ta=document.querySelector('#ovl .editbox'); const e=S.editing; S.editing=null; ta&&ta.remove(); if(e&&e.isNew&&S.undo.length){ S.doc.root=JSON.parse(S.undo.pop()); S.sel=find(S.doc.root,S.sel)?S.sel:S.doc.root.id; touch(); } else drawMap(); $('#cv').focus(); }
// ---------- stage pointer handling ----------
function nodeAt(e){ let t=e.target; if(t&&t.id==='stage'||t&&t.closest&&!t.closest('#mapsvg')){ const h=document.elementFromPoint(e.clientX,e.clientY); if(h) t=h; } const g=t&&t.closest&&t.closest('g.node'); return g?g.dataset.id:null; }
function stagePoint(e){ const r=$('#stage').getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; }
function worldAt(x,y){ const {tx,ty,sc}=S.vp; return [(x-tx)/sc,(y-ty)/sc]; }
function bindStage(){ const st=$('#stage'); if(!st) return; const pts=new Map(); let pan=null, drag=null, pinch=null, lp=null;
  st.addEventListener('pointerdown',e=>{ if(e.target.closest('.editbox')||e.target.closest('.nodetb')||e.button===2) return;
    // touch: no compatibility mousedown afterwards, so it can't move focus away from an editor opened by this tap (Android keyboard)
    if(e.pointerType!=='mouse') e.preventDefault(); st.setPointerCapture(e.pointerId); pts.set(e.pointerId,stagePoint(e));
    if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),c:[(a[0]+b[0])/2,(a[1]+b[1])/2]}; pan=null; drag=null; clearTimeout(lp); return; }
    const id=nodeAt(e), [x,y]=stagePoint(e);
    if(e.target.closest('.handle')){ e.preventDefault(); addChild(); return; }
    if(e.target.closest('.cc')){ e.preventDefault(); toggleCollapse(id); return; }
    if(id){ drag={id,x0:x,y0:y,moved:false,link:!!e.target.closest('[data-link]')}; if(e.pointerType!=='mouse') lp=setTimeout(()=>{ if(drag&&!drag.moved){ drag=null; S.sel=id; drawAll(); openNodeMenu(id,e.clientX,e.clientY); if(MENU) MENU.lp=true; } },520); }
    else pan={x0:x,y0:y,tx:S.vp.tx,ty:S.vp.ty,moved:false}; });
  st.addEventListener('pointermove',e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,stagePoint(e)); const [x,y]=stagePoint(e);
    if(pinch&&pts.size===2){ const [a,b]=[...pts.values()]; const d=Math.hypot(a[0]-b[0],a[1]-b[1]); const c=[(a[0]+b[0])/2,(a[1]+b[1])/2]; const f=d/pinch.d; const v=S.vp, ns=Math.max(.15,Math.min(3,v.sc*f)), k=ns/v.sc; S.vp={sc:ns,tx:c[0]-(pinch.c[0]-v.tx)*k,ty:c[1]-(pinch.c[1]-v.ty)*k}; pinch={d,c}; applyVp(); return; }
    if(pan){ if(Math.hypot(x-pan.x0,y-pan.y0)>3) pan.moved=true; S.vp={...S.vp,tx:pan.tx+x-pan.x0,ty:pan.ty+y-pan.y0}; applyVp(); }
    else if(drag){ if(!drag.moved&&Math.hypot(x-drag.x0,y-drag.y0)>6){ drag.moved=true; clearTimeout(lp); if(drag.id===S.doc.root.id||S.preview){drag=null;return;} st.classList.add('dragging'); }
      if(drag&&drag.moved){ const [wx,wy]=worldAt(x,y); let t=null; for(const n of lay.by.values()){ if(n.id!==drag.id&&n.x!==undefined&&Math.abs(wx-n.x)<=n.w/2+6&&Math.abs(wy-n.y)<=n.h/2+6){t=n;break;} }
        const where=t?(wy<t.y-t.h/4&&t.d>0?'before':wy>t.y+t.h/4&&t.d>0?'after':'child'):null; drag.t=t&&t.id; drag.where=where; if(S.drop!==drag.t){S.drop=drag.t; drawMap();} showGhost(x,y,drag); } } });
  const end=e=>{ if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId); clearTimeout(lp); if(pts.size<2&&pinch){ pinch=null; drawMap(); return; }
    if(pan){ if(!pan.moved&&!e.target.closest('g.node')){ /* click on empty canvas */ } if(pan.moved) drawMap(); pan=null; }
    else if(drag){ const d=drag; drag=null; st.classList.remove('dragging'); hideGhost(); if(d.moved){ S.drop=null; if(d.t) moveNode(d.id,d.t,d.where); else drawMap(); }
      else if(d.link){ if(S.editing) commitEdit(); select(d.id,{scroll:false}); openDetails('link'); }
      else { if(S.editing) commitEdit(); if(S.sel===d.id&&(e.detail>=2||e.pointerType!=='mouse')) startEdit(d.id); /* touch: tap the selected node again → edit; focus happens inside this gesture so the phone keyboard opens */ else { select(d.id,{scroll:false}); if(!isM()) $('#cv').focus({preventScroll:true}); } } } };
  st.addEventListener('pointerup',end); st.addEventListener('pointercancel',end);
  st.addEventListener('dblclick',e=>{ const id=nodeAt(e); if(id) startEdit(id); });
  st.addEventListener('contextmenu',e=>{ const id=nodeAt(e); if(!id) return; e.preventDefault(); S.sel=id; drawAll(); openNodeMenu(id,e.clientX,e.clientY); });
  st.addEventListener('wheel',e=>{ e.preventDefault(); const [x,y]=stagePoint(e); if(e.ctrlKey||e.metaKey) zoomAt(Math.exp(-e.deltaY*.01),x,y); else { S.vp={...S.vp,tx:S.vp.tx-(e.shiftKey?e.deltaY:e.deltaX),ty:S.vp.ty-(e.shiftKey?0:e.deltaY)}; applyVp(); } },{passive:false});
  const ai=$('#aibar'); if(ai){ const q=$('#aiq'), sb=ai.querySelector('.send'); q.addEventListener('input',()=>sb.disabled=!q.value.trim()); ai.addEventListener('submit',e=>{e.preventDefault(); if(q.value.trim()) aiFromBar(q.value.trim());}); } }
function showGhost(x,y,d){ let g=$('#ghost'); const n=lay.by.get(d.id); if(!g){g=document.createElement('div');g.id='ghost';g.className='dragghost';$('#ovl').appendChild(g);} g.textContent=(n?n.t:'')+(d.t?(d.where==='child'?' → 成為子節點':d.where==='before'?' → 放到上方':' → 放到下方'):''); g.style.left=(x+14)+'px'; g.style.top=(y+10)+'px'; }
function hideGhost(){ $('#ghost')?.remove(); }
// ---------- keyboard ----------
function navigate(key){ const f=selInfo(); if(!f) return select(S.doc.root.id); const n=lay.by.get(f.n.id);
  const mode=lay.r.layout;
  if(mode==='org'){ // spatial: nearest visible node in that direction
    const dir={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[key]; if(key==='ArrowDown'&&f.n.collapsed) toggleCollapse(f.n.id);
    const best=[...lay.by.values()].filter(m=>m!==n&&m.x!==undefined&&((m.x-n.x)*dir[0]+(m.y-n.y)*dir[1])>4).map(m=>{ const dx=m.x-n.x, dy=m.y-n.y, along=dx*dir[0]+dy*dir[1], across=Math.abs(dx*dir[1])+Math.abs(dy*dir[0]); return [along+across*3,m]; }).sort((a,b)=>a[0]-b[0])[0];
    if(best) select(best[1].id); return; }
  if(mode==='balanced'&&(key==='ArrowLeft'||key==='ArrowRight')){ const toChild=n.d===0||(n.side===-1)===(key==='ArrowLeft');
    if(!toChild&&f.parent) return select(f.parent.id);
    if(toChild){ if(f.n.collapsed) toggleCollapse(f.n.id); const k=kids(n).filter(c=>n.d>0||(key==='ArrowLeft'?c.side===-1:c.side!==-1)); if(k.length){ const near=[...k].sort((a,b)=>Math.abs(a.y-n.y)-Math.abs(b.y-n.y))[0]; return select(near.id);} } return; }
  if(key==='ArrowLeft'&&f.parent) return select(f.parent.id);
  if(key==='ArrowRight'){ if(f.n.collapsed) toggleCollapse(f.n.id); const k=kids(n); if(k.length){ const near=[...k].sort((a,b)=>Math.abs(a.y-n.y)-Math.abs(b.y-n.y))[0]; return select(near.id);} return; }
  if(key==='ArrowUp'||key==='ArrowDown'){ // visual neighbour in the same column first, else sibling
    if(f.parent){ const j=f.idx+(key==='ArrowUp'?-1:1); if(j>=0&&j<f.parent.c.length) return select(f.parent.c[j].id); }
    const cand=[...lay.by.values()].filter(m=>m.x!==undefined&&m.d===n.d&&(key==='ArrowUp'?m.y<n.y:m.y>n.y)).sort((a,b)=>Math.abs(a.y-n.y)-Math.abs(b.y-n.y)); if(cand[0]) select(cand[0].id); } }
function canvasKey(e){ if(S.editing||S.view!=='editor') return; const k=e.key, c=e.ctrlKey||e.metaKey;
  if(S.preview&&!['Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)) return;
  if(k==='Tab'&&!c&&!e.altKey){ e.preventDefault(); e.shiftKey?outdent():addChild(); }
  else if(k==='Enter'&&!c){ e.preventDefault(); e.shiftKey?startEdit(S.sel):addSibling(); }
  else if(k===' '||k==='F2'){ e.preventDefault(); startEdit(S.sel||S.doc.root.id); }
  else if(k==='Delete'||k==='Backspace'){ e.preventDefault(); removeSel(); }
  else if(k.startsWith('Arrow')&&e.altKey){ e.preventDefault(); if(k==='ArrowUp')reorder(-1); else if(k==='ArrowDown')reorder(1); }
  else if(k.startsWith('Arrow')){ e.preventDefault(); navigate(k); }
  else if(c&&!e.altKey&&!e.shiftKey&&/^[cxv]$/i.test(k)) clipKey(k.toLowerCase());
  else if(c&&k==='.'){ e.preventDefault(); toggleCollapse(); }
  else if(c&&/^[1-5]$/.test(k)){ e.preventDefault(); const f=selInfo(); setField('pri',f&&f.n.pri===+k?0:+k); }
  else if(c&&k==='0'){ e.preventDefault(); setField('pri',0); }
  else if(k==='Escape'){ e.preventDefault(); if(S.preview) return endPreview(); const b=$('.tb .tbtn'); (b&&b.offsetParent?b:$('.right-actions button:not([hidden])'))?.focus(); }
  else if(k==='?'){ e.preventDefault(); openDialog({type:'shortcuts'}); }
  else if((e.keyCode===229||k==='Process'||e.isComposing)&&!c&&!e.altKey&&S.sel){ startEdit(S.sel); const ta=$('#ovl .editbox'); if(ta) ta.value=''; } // IME (注音/拼音): open the editor and let the composition continue there — no preventDefault
  else if(/^[\p{L}\p{N}]$/u.test(k)&&!c&&!e.altKey&&S.sel){ // typing starts editing (GitMind habit)
    e.preventDefault(); startEdit(S.sel); const ta=$('#ovl .editbox'); if(ta){ta.value=k;ta.setSelectionRange(1,1);} } }
document.addEventListener('keydown',e=>{ const t=e.target, typing=t.matches&&t.matches('input,textarea,select,[contenteditable]'), c=e.ctrlKey||e.metaKey;
  if(e.key==='Escape'&&closeMenu(true)) { e.preventDefault(); return; }
  if(S.dialog&&t.classList&&t.classList.contains('emb')&&t.closest('#emgrid')&&/^Arrow/.test(e.key)){ e.preventDefault(); const bs=[...$$('#emgrid .emb')], i=bs.indexOf(t), top=bs[0].offsetTop, cols=Math.max(1,bs.filter(b=>b.offsetTop===top).length); const j={ArrowLeft:i-1,ArrowRight:i+1,ArrowUp:i-cols,ArrowDown:i+cols}[e.key]; const nb=bs[Math.max(0,Math.min(bs.length-1,j))]; bs.forEach(b=>b.tabIndex=-1); nb.tabIndex=0; nb.focus(); return; }
  if(S.dialog&&t.id==='em-q'&&e.key==='ArrowDown'){ e.preventDefault(); $('#emgrid .emb')?.focus(); return; }
  if(S.dialog&&t.id==='em-q'&&e.key==='Enter'){ e.preventDefault(); $('#emgrid .emb')?.click(); return; }
  if(S.dialog){ if(e.key==='Escape'){ e.preventDefault(); closeDialog(); } else if(e.key==='Tab') trapFocus(e); return; }
  if(c&&e.key.toLowerCase()==='s'){ e.preventDefault(); if(remote()) pushNow(); else toast('已存在這個瀏覽器'+(secrets.pat()?'（目前設定：只存瀏覽器）':'')); return; }
  if(e.altKey&&e.key==='0'){ e.preventDefault(); $('#cv')?.focus(); return; }
  if(t.classList&&t.classList.contains('olin')&&olKey(e,t)) return;
  if(t.id==='tagin'&&(e.key==='Enter'||e.key===','||e.key==='，')&&!e.isComposing&&e.keyCode!==229){ e.preventDefault(); addTag(t.value); return; }
  if(t.id==='linkin'&&e.key==='Enter'&&!e.isComposing){ e.preventDefault(); act('linkSave'); return; }
  if(t.id==='imgurl'&&e.key==='Enter'&&!e.isComposing){ e.preventDefault(); act('imgUrl'); return; }
  if(t.id==='findq'){ if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){ e.preventDefault(); goFind(S.find.i+(e.shiftKey?-1:1)); return; } if(e.key==='Escape'){ e.preventDefault(); closeFind(); return; } }
  if(S.view==='editor'&&S.doc&&!S.editing){ if(c&&!e.altKey&&e.key.toLowerCase()==='f'){ e.preventDefault(); openFind(); return; }
    if(e.key==='F3'||(c&&e.key.toLowerCase()==='g')){ e.preventDefault(); if(!S.find) return openFind(); goFind(S.find.i+(e.shiftKey?-1:1)); return; } }
  if(typing) { if(e.key==='Escape'&&S.panel&&t.closest('#panelHost')){ e.preventDefault(); closePanel(); } return; }
  if(c&&e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='v'&&(S.view==='editor'||S.view==='list')){ e.preventDefault(); act('mdImport'); return; }
  if(c&&!e.shiftKey&&e.key.toLowerCase()==='z'){ if(S.doc){e.preventDefault();undo();} return; }
  if(c&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){ if(S.doc){e.preventDefault();redo();} return; }
  if(c&&e.key.toLowerCase()==='o'&&S.doc){ e.preventDefault(); act('outline'); return; }
  if(c&&e.altKey&&e.key.toLowerCase()==='m'&&S.doc){ e.preventDefault(); act('note'); return; }
  if(c&&e.key.toLowerCase()==='j'&&S.doc){ e.preventDefault(); act('aiExpand'); return; }
  if(e.altKey&&e.key.toLowerCase()==='y'&&S.doc){ e.preventDefault(); act('style'); return; }
  if(e.key==='F6'&&S.doc&&!isM()){ e.preventDefault(); act('randomTheme'); return; }
  if(e.key==='/'&&!c){ const s=$('#homeq')||$('#sideq'); if(s){e.preventDefault();s.focus();} return; }
  if(t.closest&&t.closest('#cv')&&!t.closest('#panelHost')&&!t.closest('.zoom')&&!t.closest('.cbar')) canvasKey(e);
  else if(e.key==='Escape'&&S.panel){ closePanel(); } });
// ---------- menus (WAI-ARIA menu pattern: focus first item, arrows move, Esc returns focus) ----------
let MENU=null;
function openMenu(html,trigger,pos){ closeMenu(); const L=$('#layer'); L.insertAdjacentHTML('beforeend',`<div class="mscrim menuscrim" data-act="closeMenu"></div>`+html); const m=L.lastElementChild; MENU={el:m,trigger};
  if(trigger) trigger.setAttribute('aria-expanded','true');
  const W=innerWidth,H=innerHeight, r=m.getBoundingClientRect(); let x=pos.x, y=pos.y; if(pos.alignRight) x=pos.x-r.width; x=Math.max(8,Math.min(W-r.width-8,x)); if(y+r.height>H-8) y=Math.max(8,(pos.yAbove??H)-r.height-8); m.style.left=x+'px'; m.style.top=y+'px';
  const items=()=>[...m.querySelectorAll('[role=menuitem],[role=menuitemradio]')].filter(x=>!x.disabled);
  items()[0]?.focus();
  m.addEventListener('keydown',e=>{ const it=items(), i=it.indexOf(document.activeElement);
    if(e.key==='ArrowDown'||e.key==='ArrowRight'&&m.classList.contains('lpmenu')){e.preventDefault();it[(i+1)%it.length].focus();}
    else if(e.key==='ArrowUp'||e.key==='ArrowLeft'&&m.classList.contains('lpmenu')){e.preventDefault();it[(i-1+it.length)%it.length].focus();}
    else if(e.key==='Home'){e.preventDefault();it[0].focus();} else if(e.key==='End'){e.preventDefault();it[it.length-1].focus();}
    else if(e.key==='Tab'){e.preventDefault();closeMenu(true);} }); }
function closeMenu(restore){ if(!MENU) return false; const {el,trigger}=MENU; MENU=null; el.remove(); $('#layer .menuscrim')?.remove(); if(trigger){trigger.setAttribute('aria-expanded','false'); if(restore&&document.contains(trigger)) trigger.focus();} return true; }
const mi=(act,icon,label,cls='',v='')=>`<button role="menuitem" tabindex="-1" data-act="${act}"${v!==''?` data-v="${esc(v)}"`:''}${cls?` class="${cls}"`:''}>${I(icon)}<span>${label}</span></button>`;
function openNodeMenu(id,x,y){ const n=find(S.doc.root,id).n; const it=[['addChild','child','子主題'],['addSibling','sibling','同級'],['edit','edit','編輯文字'],['icons','smile','圖示'],['note','note','詳情'],['outdent','parent','升一層'],['priMenu','alert','優先順序'],['style','palette','樣式'],['copyNode','copy','複製一份'],['copyMd','outline','複製 Markdown'],['pasteMd','paste','貼上 Markdown'],['collapse','minus',n.collapsed?'展開':'收合'],['aiExpand','spark','AI 擴充'],['delete','trash','刪除','del']];
  openMenu(`<div class="lpmenu" role="menu" aria-label="「${esc(n.t)}」的動作"><div class="lphead" aria-hidden="true">${esc(n.t)}</div><div class="lpgrid">${it.map(([a,i,l,c])=>mi(a,i,l,c||'')).join('')}</div></div>`,null,{x:x-150,y:y+16,yAbove:y-16}); MENU.trigger=$('#cv'); }
function openMoreMenu(trigger){ const r=trigger.getBoundingClientRect();
  const n=S.unsynced, syncIt=S.remote?mi('syncNow',S.driveAuth||S.sync.state==='error'?'alert':'cloud',S.driveAuth?'重新連結 Google 才能同步':S.sync.state==='saving'?'同步中…':n?`同步（${n} 項未同步）`:'已同步，再同步一次',S.driveAuth||S.sync.state==='error'?'warnit':n?'hasit':'')+'<hr>':'';
  openMenu(`<div class="ctx mmenu" role="menu" aria-label="更多">${syncIt}
  <div class="mrow" role="group" aria-label="顯示層級"><span>層級</span><div class="seg">${[1,2,3,0].map(l=>`<button role="menuitem" tabindex="-1" data-act="level" data-v="${l}">${l||'全部'}</button>`).join('')}</div></div>
  <div class="mrow" role="group" aria-label="縮放"><span>縮放</span><div class="seg"><button role="menuitem" tabindex="-1" data-act="zoomOut" aria-label="縮小">${I('minus')}</button><span class="pctb" aria-live="polite">${Math.round(S.vp.sc*100)}%</span><button role="menuitem" tabindex="-1" data-act="zoomIn" aria-label="放大">${I('plus')}</button><button role="menuitem" tabindex="-1" data-act="fit" aria-label="符合畫面">${I('fit')}</button></div></div>
  <hr>${mi('history','history','版本歷史')}${mi('exportMenu','download','匯出 PNG／SVG／Markdown')}${mi('copyMd','outline','複製選取節點為 Markdown')}${mi('mdImport','paste','從 Markdown 匯入／貼上')}${mi('import','upload','匯入檔案（Markdown／OPML）')}
  <hr>${S.canInstall?mi('install','download','安裝 App 到主畫面'):''}${mi('backup','download','匯出全部備份（.mymind）')}${mi('settingsA11y','palette','外觀與無障礙')}${mi('settings','gear','設定：儲存、同步與金鑰')}${mi('shortcuts','kb','手勢與快捷鍵')}</div>`,trigger,{x:r.right,y:r.bottom+6,alignRight:true}); }
function openExportMenu(trigger){ const r=(trigger||$('#cv')).getBoundingClientRect();
  openMenu(`<div class="ctx" role="menu" aria-label="匯出">${mi('exp','image','PNG 圖片（2x）','', 'png')}${mi('exp','image','SVG 向量圖','','svg')}${mi('exp','note','PDF（A4，符合頁面）','','pdf')}${mi('copyMd','copy','複製節點為 Markdown')}${mi('exp','outline','整張圖 Markdown（.md）','','md')}${mi('exp','outline','OPML','','opml')}${mi('exp','download','.mymind.json','','json')}<hr>${mi('mdImport','paste','貼上／匯入 Markdown…')}</div>`,trigger,{x:r.right,y:r.bottom+6,alignRight:true}); }
function openCardMenu(id,trigger){ const m=maps.meta(id), r=trigger.getBoundingClientRect();
  const html=m.trashed?`${mi('restoreMap','undo','還原','',id)}<hr>${mi('purgeMap','trash','永久刪除','del',id)}`:`${mi('openMap','ext','開啟','',id)}${mi('renameMap','edit','重新命名','',id)}${mi('dupMap','copy','建立副本','',id)}${mi('starMap','star',m.star?'移除星號':'加星號','',id)}${mi('expMapMd','download','匯出 Markdown','',id)}<hr>${mi('trashMap','trash','移到垃圾桶','del',id)}`;
  openMenu(`<div class="ctx" role="menu" aria-label="${esc(m.title)} 的動作">${html}</div>`,trigger,{x:r.right,y:r.bottom+4,alignRight:true}); }
function openPriMenu(){ const r=$('#cv').getBoundingClientRect(); openMenu(`<div class="ctx" role="menu" aria-label="優先順序">${[1,2,3,4,5].map(n=>mi('pri','alert','優先順序 '+n,'',n)).join('')}${mi('pri','x','清除','',0)}</div>`,$('#cv'),{x:r.left+r.width/2-110,y:r.top+80}); }
// ---------- dialogs ----------
let lastFocus=null;
function openDialog(D){ $('#toast')?.classList.remove('on'); if(!S.dialog) lastFocus=document.activeElement; S.dialog=D; drawDialog(true); }
function closeDialog(){ if(!S.dialog) return; if(S.dialog.type==='ai'&&S.dialog.ctrl) S.dialog.ctrl.abort(); const D=S.dialog; S.dialog=null; drawDialog(); if(D.onClose) D.onClose(); if(lastFocus&&document.contains(lastFocus)) lastFocus.focus(); }
function drawDialog(focus){ const L=$('#layer'); L.querySelector('.dlg')?.remove(); const D=S.dialog; if(!D) return; let html='';
  if(D.type==='settings') html=V.settingsDialog(S,D); else if(D.type==='ai') html=V.aiDialog(S,D,D.tab==='expand'&&S.doc?(selInfo()||{n:S.doc.root}).n:null); else if(D.type==='conflict') html=V.conflictDialog(D); else if(D.type==='shortcuts') html=V.shortcutsDialog(); else if(D.type==='prompt') html=V.promptDialog(D); else if(D.type==='md'){ const m=mdModel(D); html=V.mdDialog(D,m.tree,m.count); } else if(D.type==='emoji'){ const n=S.doc&&find(S.doc.root,D.nodeId); html=V.emojiDialog(D,n&&n.n.icon,(prefs.get().recentIcons||[]).slice(0,12)); }
  const w=document.createElement('div'); w.className='dlg'; w.innerHTML=html; L.appendChild(w);
  if(focus){ const f=w.querySelector(D.focus||'input,textarea,[role=tab][aria-selected=true],.modal button:not(.close)'); (f||w.querySelector('button'))?.focus(); } }
function trapFocus(e){ const m=$('#layer .dlg .modal'); if(!m) return; const f=[...m.querySelectorAll('button,a[href],input,textarea,select,summary,[tabindex="0"]')].filter(x=>!x.disabled&&x.offsetParent!==null); if(!f.length) return; const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();} else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();} }
function openSettings(tab='data',extra={}){ const p=prefs.get(); const D={type:'settings',tab,repoBefore:p.repo,form:{repo:p.repo,pat:secrets.pat(),openai:secrets.openai(),model:p.model,lines:p.lines,ui:p.ui,reduceMotion:p.reduceMotion,sync:p.sync,backend:p.backend||(secrets.pat()||tab==='gh'?'github':'drive')},drive:p.driveEmail?{email:p.driveEmail,name:p.driveName||''}:null,driveAuth:isDrive()&&!!p.driveEmail&&!GD.hasToken(),syncTouched:false,lastBackup:p.lastBackup,backend:storage.backend,...extra}; openDialog(D);
  Promise.all([storage.persisted(),storage.estimate()]).then(([per,est])=>{ D.persisted=per; D.usage=est&&est.usage; if(S.dialog===D) drawDialog(); }); }
function askText(title,label,value,ok){ return new Promise(res=>openDialog({type:'prompt',title,label,input:value,ok:'確定',focus:'#pr-in',resolve:res,onClose:()=>res(null)})); }
function confirmBox(title,sub,ok,danger){ return new Promise(res=>openDialog({type:'prompt',title,sub,ok,danger,resolve:res,onClose:()=>res(null)})); }
// ---------- AI ----------
function openAI(tab='topic',extra={}){ openDialog({type:'ai',tab,topic:'',notes:'',hint:'',depth:3,breadth:'4–6',...extra}); }
async function runAI(){ const D=S.dialog; if(!D||D.type!=='ai'||D.busy) return; const key=secrets.openai(); const model=prefs.get().model;
  ['topic','notes','hint'].forEach(k=>{const el=document.querySelector(`[data-ai="${k}"]`); if(el) D[k]=el.value;});
  if(!key){ D.error={kind:'nokey'}; return drawDialog(); }
  const f=S.doc?(selInfo()||{n:S.doc.root}):null;
  if(D.tab==='expand'&&!f){ D.error={kind:'http',message:'先開一張圖並選一個節點'}; return drawDialog(); }
  if(D.tab==='topic'&&!D.topic.trim()||D.tab==='notes'&&!D.notes.trim()){ toast('請先輸入內容'); return; }
  D.busy=true; D.error=null; D.ctrl=new AbortController(); drawDialog();
  try{ let tree;
    if(D.tab==='expand'){ const path=[]; let x=find(S.doc.root,f.n.id); while(x){path.unshift(x.n.t); x=x.parent?find(S.doc.root,x.parent.id):null;}
      tree=await AI.expand(key,model,{path,node:f.n.t,hint:D.hint},{signal:D.ctrl.signal}); const add=(tree.c||[]).map(c=>ensureIds(clone(c)));
      S.dialog=null; drawDialog(); mutate(r=>{const n=find(r,f.n.id).n; n.c=(n.c||[]).concat(add); n.collapsed=false;}); toast(`已新增 ${add.length} 個子主題`,['復原','undo']); }
    else { tree=await AI.generate(key,model,{topic:D.topic,notes:D.tab==='notes'?D.notes:'',depth:D.depth,breadth:D.breadth},{signal:D.ctrl.signal}); S.dialog=null; drawDialog(); const d=createMap(tree); d.icon='✨'; storeDoc(d); toast('已產生新圖「'+tree.t+'」'); }
  }catch(e){ if(e.name==='AbortError'){ D.busy=false; return drawDialog(); } D.busy=false; D.error={kind:e.kind||'http',message:e.message}; if(S.dialog===D) drawDialog(); else openDialog(D); } }
function aiFromBar(text){ const f=S.doc&&(selInfo()||{n:S.doc.root}); openAI('expand',{hint:text}); runAI(); const q=$('#aiq'); if(q){q.value='';q.dispatchEvent(new Event('input'));} }
// ---------- sync with GitHub ----------
// Modes (prefs.sync): 'local' = browser only (IndexedDB), never touches the network;
// 'manual' = changes stay local until 同步 / Ctrl+S; 'auto' = batched: at most one commit every AUTO_MS, plus when the tab is hidden.
// Every push sends ALL unsynced maps (and pending deletes) as ONE commit through the git data API.
// Backend (prefs.backend): 'github' (fine-grained PAT, one commit per sync) or 'drive' (Google Drive folder "MyMind", drive.file scope).
// One backend is active at a time; switching re-uploads this browser's maps to the new one (the old copy is left untouched).
const isDrive=()=>prefs.get().backend==='drive';
const BN=()=>isDrive()?'Google 雲端硬碟':'GitHub';
const remote=()=>S.syncMode!=='local'&&(isDrive()?!!prefs.get().driveEmail:!!secrets.pat());
let driveC=null; const dc=()=>driveC||(driveC=GD.driveClient());
const gh=()=>{ if(!remote()) return null; if(isDrive()) return GD.hasToken()?dc():null; return client(secrets.pat(),S.repo); };
// Drive needs a fresh token after ~1 h or a reload: one click on 「重新連結」 (a popup that closes itself once access was granted)
async function driveSignIn({consent=false}={}){ const p=prefs.get(); await GD.signIn({hint:p.driveEmail||'',prompt:consent?'consent':''}); driveC=null; S.driveAuth=false; }
async function driveReauth(){ try{ await driveSignIn(); setSync('dirty'); await syncNow({reason:'manual'}); }catch(e){ if(e.status!==-1||!/關閉/.test(e.message)) toast(e.message); } }
const pathOf=id=>`maps/${id}.json`;
const AUTO_MS=()=>+prefs.get().autoMs||3*60*1000;
function syncInfo(){ S.prefs=prefs.get(); S.backend=S.prefs.backend||'github'; S.backendName=BN(); S.driveEmail=S.prefs.driveEmail||''; S.driveAuth=isDrive()&&remote()&&!GD.hasToken(); S.mapCount=maps.index().filter(m=>!m.trashed).length; S.syncMode=S.prefs.sync; S.remote=remote(); S.unsynced=maps.dirtyCount(); S.autoMs=AUTO_MS(); }
let autoT=null, persistAsked=false;
function changed(){ syncInfo(); if(S.remote&&S.syncMode==='auto') scheduleAuto(); if(S.view!=='editor') return; }
function scheduleAuto(){ if(autoT) return; S.autoAt=Date.now()+AUTO_MS(); autoT=setTimeout(()=>{ autoT=null; S.autoAt=null; syncNow({reason:'auto'}); },AUTO_MS()); }
function askPersist(){ if(persistAsked) return; persistAsked=true; storage.persist(); }
function setSync(state,msg){ S.sync={...S.sync,state,msg:msg||'',at:state==='saved'?new Date().toISOString():S.sync.at}; drawChrome(); }
let syncing=null, syncAgain=false;
async function syncNow(opt={}){ if(syncing){ syncAgain=syncAgain||opt.push!==false; return syncing; }
  syncing=(async()=>{ try{ await syncOnce(opt); } finally { syncing=null; if(syncAgain){ syncAgain=false; await syncNow(); } } })(); return syncing; }
async function syncOnce({push=true,reason='manual'}={}){ const c=gh(); if(!c){ if(remote()&&isDrive()){ syncInfo(); setSync('auth','需要重新連結 Google 才能同步'); } return; }
  if(!navigator.onLine){ setSync('offline'); return; }
  if(push&&maps.dirtyCount()||reason==='manual') setSync('saving'); let pulled=0, pushedN=0;
  try{
    for(let attempt=0;attempt<2;attempt++){
      const files=(await c.list('maps')).filter(f=>f.name.endsWith('.json')); const rsha=new Map(files.map(f=>[f.name.replace(/\.json$/,''),f.sha]));
      // maps that exist on both sides but were never synced from here (new device, backend switch): same content = already in sync
      for(const m of maps.index()){ const rs=rsha.get(m.id); if(!rs||m.sha||!m.dirty) continue; try{ const r=await c.blob(rs); const d=JSON.parse(r.text), mine=maps.load(m.id); if(mine&&JSON.stringify({...d,id:m.id})===JSON.stringify(mine)){ maps.saveBase(m.id,mine); maps.setMeta(m.id,{sha:rs,remote:true,dirty:false}); } }catch{} }
      let conflicts=[];
      if(push){ const dirty=maps.index().filter(m=>m.dirty); const dels=maps.deletes(); const changes=[], pushed=[];
        for(const m of dirty){ const rs=rsha.get(m.id); if(rs&&rs!==m.sha){ conflicts.push(m.id); continue; } const doc=maps.load(m.id); if(!doc){ maps.setMeta(m.id,{dirty:false}); continue; }
          const text=JSON.stringify(doc,null,1)+'\n'; changes.push({path:pathOf(m.id),text}); pushed.push({id:m.id,doc,text,title:doc.root.t}); }
        const delIds=dels.filter(id=>rsha.has(id)); delIds.forEach(id=>changes.push({path:pathOf(id),del:true}));
        if(changes.length){ const names=pushed.map(x=>'「'+x.title+'」');
          const msg=pushed.length===1&&!delIds.length?`${maps.meta(pushed[0].id).sha?'更新':'建立'}${names[0]}`:`同步 ${pushed.length} 張心智圖${delIds.length?`、刪除 ${delIds.length} 張`:''}${names.length?'：'+names.slice(0,5).join('、')+(names.length>5?'…':''):''}`;
          let res; try{ res=await c.commitFiles(changes,msg); }
          catch(e){ if((e.status===409||e.status===422)&&attempt===0) continue; throw e; } // someone else moved the branch: re-list and retry once
          for(const x of pushed){ const sha=res&&res.shas&&res.shas[pathOf(x.id)]||await blobSha(x.text); const latest=maps.load(x.id); maps.setMeta(x.id,{sha,remote:true,dirty:JSON.stringify(latest)!==JSON.stringify(x.doc)}); maps.saveBase(x.id,x.doc); rsha.set(x.id,sha); }
          S.lastPush={at:Date.now(),maps:pushed.length,deletes:delIds.length}; pushedN=pushed.length+delIds.length; }
        maps.setDeletes(maps.deletes().filter(id=>!dels.includes(id)));
        if(changes.length&&c.writeIndex){ try{ await c.writeIndex(maps.index().filter(m=>!m.trashed).map(m=>({id:m.id,title:m.title,icon:m.icon||'',updated:m.updated,file:m.id+GD.EXT}))); }catch(e){ if(e.status===401) throw e; } } }
      // pull: new or changed files from other devices (read-only, no commits)
      const deletes=new Set(maps.deletes());
      for(const [id,sha] of rsha){ const m=maps.meta(id); if(deletes.has(id)||m&&m.sha===sha) continue; if(m&&m.dirty){ if(!conflicts.includes(id)) conflicts.push(id); continue; }
        const r=await c.blob(sha); let d; try{ d=JSON.parse(r.text); }catch{ continue; } if(!d||!d.root) continue; d.id=id; ensureIds(d.root);
        maps.save(id,d); maps.saveBase(id,d); maps.setMeta(id,{...metaFrom(d),sha:r.sha,remote:true,dirty:false}); pulled++; if(S.mapId===id&&!S.editing){ S.doc=d; } }
      for(const m of maps.index()){ if(m.remote&&!rsha.has(m.id)&&!m.dirty){ maps.remove(m.id); if(S.mapId===m.id) location.hash='#/'; } else if(m.remote&&!rsha.has(m.id)&&m.dirty) maps.setMeta(m.id,{sha:null}); }
      syncInfo(); setSync(conflicts.length?'error':S.unsynced?'dirty':'saved',conflicts.length?'雲端有比較新的版本':'');
      if(conflicts.length) await openConflict(conflicts[0],rsha.get(conflicts[0]));
      if(reason==='manual'&&!conflicts.length) toast(pushedN?(pushedN>1?`已同步 ${pushedN} 項到 ${BN()}${isDrive()?'':'（1 個 commit）'}`:`已同步到 ${BN()}`)+(pulled?`，並更新 ${pulled} 張其他裝置改過的圖`:''):pulled?`已從 ${BN()} 更新 ${pulled} 張圖`:'已是最新版本');
      render(); return; }
  }catch(e){ if(e.status===0) setSync('offline'); else if(isDrive()&&e.status===401){ GD.forgetToken(); syncInfo(); setSync('auth','Google 登入已過期，按「重新連結」繼續同步'); } else if(isDrive()) setSync('error',e.status===403?'Google 雲端硬碟拒絕存取（403）：請重新連結並勾選權限':e.status===404?'雲端找不到檔案（404）':e.status===429||e.status>=500?'Google 暫時忙碌，稍後會再試':e.message); else setSync('error',e.status===401?'金鑰無效或過期（401）':e.status===403?'金鑰沒有寫入權限（403）':e.status===404?'找不到儲存庫或沒有權限（404）':e.message); render(); } }
const syncAll=()=>syncNow({push:S.syncMode==='auto'&&maps.dirtyCount()>0,reason:'auto'});
const pushNow=()=>syncNow({reason:'manual'});
async function openConflict(id,sha){ const c=gh(); let remoteF; try{ remoteF=sha?await c.blob(sha):await c.get(pathOf(id)); }catch(e){ return setSync('error',e.message); }
  const theirs=JSON.parse(remoteF.text), mine=maps.load(id), base=maps.base(id)||theirs; const T=THEMES[mine.theme]||THEMES[DEFAULT_THEME];
  const svgOf=d=>{const r=layout(clone(d.root),T,d.settings||{});const {svg,b}=renderMap(r,T,{thumb:true});return `<svg viewBox="${b.x0-20} ${b.y0-20} ${b.w+40} ${b.h+40}" aria-hidden="true">${svg}</svg>`;};
  let when=''; try{ const cm=await c.commits(pathOf(id)); when=cm[0]?V.rel(cm[0].date):''; }catch{}
  openDialog({type:'conflict',id,pick:'merge',title:mine.root.t,canvas:T.canvas,sha:remoteF.sha,remoteSha:remoteF.sha,theirs,mine,base,when,mineDiff:diffSummary(base,mine),theirsDiff:diffSummary(base,theirs),mineSvg:svgOf(mine),theirsSvg:svgOf(theirs)}); setSync('error','雲端有比較新的版本'); }
async function applyConflict(){ const D=S.dialog; const {id,pick,theirs,mine,base,remoteSha}=D; S.dialog=null; drawDialog();
  if(pick==='theirs'){ const copy={...clone(mine),id:newId(),root:{...clone(mine.root)}}; copy.root.t=mine.root.t+'（我的副本）'; storeDoc(copy);
    maps.save(id,theirs); maps.saveBase(id,theirs); maps.setMeta(id,{...metaFrom(theirs),sha:remoteSha,dirty:false,remote:true}); if(S.mapId===id){S.doc=theirs;S.undo=[];} toast('已改用雲端版本；你的修改另存成副本'); }
  else { let doc=mine; if(pick==='merge'){ const r=merge3(base,mine,theirs); doc=r.doc; if(r.conflicts) toast(`已合併；${r.conflicts} 處兩邊都改，保留了你的版本`); else toast('已自動合併兩邊的修改'); }
    maps.save(id,doc); maps.saveBase(id,theirs); maps.setMeta(id,{...metaFrom(doc),sha:remoteSha,dirty:true}); if(S.mapId===id) S.doc=doc; }
  render(); await syncNow({reason:'conflict'}); }
addEventListener('online',()=>{ if(remote()) syncAll(); });
addEventListener('offline',()=>{ if(remote()) setSync('offline'); });
setInterval(()=>{ if(remote()&&document.visibilityState==='visible') syncNow({push:false,reason:'auto'}); },5*60000); // pull only
// auto mode: flush when the tab is hidden or closed (best effort; anything left is pushed on the next visit)
const flushAuto=()=>{ if(remote()&&S.syncMode==='auto'&&maps.dirtyCount()){ clearTimeout(autoT); autoT=null; syncNow({reason:'hidden'}); } };
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') flushAuto(); });
addEventListener('pagehide',flushAuto);
addEventListener('beforeunload',e=>{ if(remote()&&S.syncMode==='manual'&&maps.dirtyCount()){ e.preventDefault(); e.returnValue=''; } });
// ---------- backup / restore (everything in this browser, one file) ----------
function backupAll(){ const all=maps.index().map(m=>maps.load(m.id)).filter(Boolean); const d=new Date(); const stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  IO.download(`mymind-backup-${stamp}.mymind`,JSON.stringify({format:'mymind-backup/1',exported:d.toISOString(),count:all.length,maps:all},null,1),'application/json');
  prefs.set({lastBackup:d.toISOString()}); toast(`已匯出 ${all.length} 張心智圖的備份`); if(S.view==='list') render(); }
function restoreBackup(data){ const list=Array.isArray(data.maps)?data.maps:[]; let added=0,updated=0,kept=0;
  for(const d of list){ if(!d||!d.root||!d.id) continue; ensureIds(d.root); const cur=maps.load(d.id);
    if(!cur){ storeDoc(d); added++; } else if((d.updated||'')>(cur.updated||'')){ storeDoc(d); updated++; } else kept++; }
  changed(); render(); toast(`已還原：新增 ${added} 張、更新 ${updated} 張${kept?`、${kept} 張本機較新所以保留`:''}`); return {added,updated,kept}; }
// history
async function loadHistory(){ const c=gh(); S.hist={items:[],loading:!!c,error:''}; drawPanel(); if(!c) return; try{ S.hist.items=await c.commits(pathOf(S.mapId)); }catch(e){ S.hist.error=e.status===404?'找不到紀錄':e.message; } S.hist.loading=false; drawPanel(); }
async function preview(sha){ const c=gh(); try{ const r=await c.get(pathOf(S.mapId),sha); const d=JSON.parse(r.text); const it=S.hist.items.find(i=>i.sha===sha); S.preview={sha,doc:d,label:it?V.rel(it.date):sha.slice(0,7)}; S.vpFor=null; render(); }catch(e){ toast('讀取版本失敗：'+e.message); } }
function endPreview(){ S.preview=null; render(); }
function restorePreview(){ const d=S.preview.doc, label=S.preview.label; S.preview=null; render(); mutate(r=>{ r.t=d.root.t; r.c=clone(d.root.c||[]); FIELDS_ROOT.forEach(k=>{ if(d.root[k]!==undefined) r[k]=d.root[k]; else delete r[k]; }); }); S.doc.theme=d.theme||S.doc.theme; S.doc.settings=d.settings||{}; storeDoc(S.doc); toast('已還原到 '+label+'，儲存後會新增一個版本'); }
const FIELDS_ROOT=['note','icon','pri','hl','collapsed'];
// ---------- import / export ----------
function pickFile(onMd){ const inp=document.createElement('input'); inp.type='file'; inp.accept='.md,.markdown,.txt,.opml,.xml,.json,.mymind'; inp.onchange=async()=>{ const f=inp.files[0]; if(!f) return; const text=await f.text();
  if(onMd&&!/\.(opml|xml|json|mymind)$/i.test(f.name)&&!/^\s*(<\?xml|<opml|\{)/i.test(text)) return onMd(text,f.name);
  if(onMd&&S.dialog) closeDialog();
  try{ if(/\.mymind$/i.test(f.name)||/"format"\s*:\s*"mymind-backup/.test(text.slice(0,200))){ restoreBackup(JSON.parse(text)); return; } let root; if(/\.(opml|xml)$/i.test(f.name)||/^\s*<\?xml|<opml/i.test(text)) root=IO.fromOPML(text); else if(/\.json$/i.test(f.name)){ const d=JSON.parse(text); root=ensureIds(d.root||d); } else root=IO.fromMarkdown(text);
    const d=createMap(root); toast(`已匯入「${root.t}」，共 ${allDeep(root).length} 個節點`); }catch(e){ toast('匯入失敗：'+e.message); } }; inp.click(); }
async function exportAs(kind,doc=S.doc){ const name=(doc.root.t||'mymind').replace(/[\\/:*?"<>|]/g,'_');
  if(kind==='md'){ const md=IO.toMarkdown(doc.root); copyPayload({md,html:IO.toClipboardHTML(doc.root,true)},`已複製整張圖為 Markdown（${allDeep(doc.root).length} 個節點），並下載 .md`); return IO.download(name+'.md',md,'text/markdown'); }
  if(kind==='opml') return IO.download(name+'.opml',IO.toOPML(doc.root),'text/xml');
  if(kind==='json') return IO.download(name+'.mymind.json',JSON.stringify(doc,null,1),'application/json');
  const T=THEMES[doc.theme]||THEMES[DEFAULT_THEME]; const r=layout(clone(doc.root),T,doc.settings||{}); const {svg,b}=renderMap(r,T,{lightLines:S.lines==='light',edge:(doc.settings||{}).edge,lw:(doc.settings||{}).lw});
  const s=IO.svgString(svg,b,T.canvas); if(kind==='svg') return IO.download(name+'.svg',s.s,'image/svg+xml');
  if(kind==='pdf'){ try{ IO.download(name+'.pdf',await IO.toPDF(s.s,s.w,s.h,{title:doc.root.t,bg:T.canvas})); toast('已下載 PDF（A4，符合頁面）'); }catch(e){ toast('PDF 匯出失敗：'+e.message); } return; }
  try{ IO.download(name+'.png',await IO.toPNG(s.s,s.w,s.h,2)); }catch(e){ toast(e.message); } }
// ---------- Markdown clipboard (v1.2) ----------
let CLIP=null;
function pastebin(){ let t=$('#pastebin'); if(!t){ t=document.createElement('textarea'); t.id='pastebin'; t.className='pastebin'; t.tabIndex=-1; t.setAttribute('aria-hidden','true'); document.body.appendChild(t); } return t; }
const stripIds=n=>{ const {id,...r}=n; if(r.c) r.c=r.c.map(stripIds); return r; };
const countNodes=ns=>ns.reduce((a,n)=>a+allDeep(n).length,0);
function clipPayload(n,asRoot){ return {md:IO.toMarkdown(n,{asRoot}),html:IO.toClipboardHTML(n,asRoot)}; }
function copyMsg(n){ return `已複製「${n.t}」為 Markdown（${allDeep(n).length} 個節點）`; }
function refocusCanvas(){ const cv=$('#cv'); if(cv&&document.activeElement&&(document.activeElement.id==='pastebin'||document.activeElement===document.body)) cv.focus({preventScroll:true}); }
// menu-triggered copy: select a hidden textarea and run the copy command inside the click, so it also works on iOS
function copyPayload(p,msg){ const ta=pastebin(); CLIP={...p,msg}; ta.value=p.md; ta.focus({preventScroll:true}); ta.select(); let ok=false; try{ ok=document.execCommand('copy'); }catch{} const used=CLIP===null; CLIP=null; refocusCanvas();
  if(ok&&used) return; if(ok) return toast(msg);
  const fail=()=>toast('無法存取剪貼簿，請改用「匯出 › 整張圖 Markdown」下載');
  if(!navigator.clipboard) return fail();
  try{ navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([p.md],{type:'text/plain'}),'text/html':new Blob([p.html],{type:'text/html'})})]).then(()=>toast(msg),()=>navigator.clipboard.writeText(p.md).then(()=>toast(msg),fail)); }
  catch{ navigator.clipboard.writeText(p.md).then(()=>toast(msg),fail); } }
// keyboard copy / cut / paste on the canvas: move focus to the hidden textarea so the browser fires the clipboard event there (Safari needs an editable target)
function clipKey(k){ const g=selInfo(); if(!g&&k!=='v') return; const ta=pastebin();
  if(k==='v'){ ta.value=''; ta.focus({preventScroll:true}); setTimeout(refocusCanvas,50); return; }
  const p=clipPayload(g.n,!g.parent); CLIP={...p,msg:k==='x'?`已剪下「${g.n.t}」`:copyMsg(g.n),cut:k==='x'?g.n.id:null}; ta.value=p.md; ta.focus({preventScroll:true}); ta.select(); setTimeout(()=>{ CLIP=null; refocusCanvas(); },50); }
document.addEventListener('focusin',e=>{ const t=e.target; if(t.classList&&t.classList.contains('olin')){ S.olId=t.dataset.olid; $$('.olr.cur').forEach(r=>r.classList.remove('cur')); t.closest('.olr')?.classList.add('cur'); } });
document.addEventListener('copy',onCopy); document.addEventListener('cut',onCopy);
function onCopy(e){ let p=CLIP; const t=e.target;
  if(!p){ if(S.view!=='editor'||!S.doc||S.editing||S.dialog||(MENU&&MENU.el)) return; if(t&&t.matches&&t.matches('input,textarea,select,[contenteditable],[contenteditable] *')) return;
    const sel=window.getSelection(); if(sel&&String(sel).trim()) return; const g=selInfo(); if(!g) return; p={...clipPayload(g.n,!g.parent),msg:copyMsg(g.n),cut:e.type==='cut'?g.n.id:null}; }
  e.preventDefault(); e.clipboardData.setData('text/plain',p.md); e.clipboardData.setData('text/html',p.html); CLIP=null; toast(p.msg);
  if(p.cut){ const g=find(S.doc.root,p.cut); if(g&&g.parent){ S.sel=p.cut; removeSel(); toast(p.msg,['復原','undo']); } else if(g) toast('已複製；中心主題不能剪下'); } }
document.addEventListener('paste',e=>{ const t=e.target, dt=e.clipboardData; if(!dt) return; const html=dt.getData('text/html')||'', txt=dt.getData('text/plain')||'';
  if(t&&t.classList&&t.classList.contains('editbox')&&S.editing){ // inline editing: keep plain-text paste, offer conversion
    if(/\S\s*\n\s*\S/.test(txt)||html.includes('data-mymind')){ S.pasteEdit={id:S.editing.id,before:t.value,txt,html}; setTimeout(()=>toast('貼上了多行文字，要轉成節點嗎？',['轉成節點','pasteEditNodes']),0); } return; }
  if(t&&t.id!=='pastebin'&&t.matches&&t.matches('input,textarea,select,[contenteditable],[contenteditable] *')) return;
  if(S.dialog||(MENU&&MENU.el)) return;
  const file=[...(dt.files||[])].find(f=>/^image\//.test(f.type)); if(file&&S.view==='editor'&&S.doc){ e.preventDefault(); setTimeout(refocusCanvas,0); const g=selInfo(); if(!g) return toast('先選一個節點再貼上圖片'); setImageFromBlob(g.n.id,file); return; }
  if(S.view==='editor'&&S.doc){ e.preventDefault(); setTimeout(refocusCanvas,0); let nodes=IO.fromClipboardHTML(html); if(!nodes){ if(!txt.trim()) return toast('剪貼簿裡沒有文字可以貼上'); try{ nodes=IO.nodesFromMarkdown(txt); }catch{ nodes=[]; } } if(!nodes.length) return toast('剪貼簿裡沒有文字可以貼上');
    pasteNodes((selInfo()||{n:S.doc.root}).n.id,nodes); }
  else if(S.view==='list'&&txt.trim()){ e.preventDefault(); openMd({md:txt,target:'new'}); } });
function pasteNodes(id,nodes,{replace=false}={}){ nodes=nodes.map(n=>ensureIds(stripIds(JSON.parse(JSON.stringify(n))))); const cnt=countNodes(nodes);
  mutate(r=>{ const g=find(r,id); if(!g) return; if(replace&&g.parent) g.parent.c.splice(g.idx,1,...nodes); else { g.n.c=(g.n.c||[]).concat(nodes); delete g.n.collapsed; } },{select:nodes[0].id});
  toast(`已貼上 ${cnt} 個節點`,['復原','undo']); }
function openMd(o){ const g=S.view==='editor'&&S.doc?(selInfo()||{n:S.doc.root}):null;
  openDialog({type:'md',md:'',nodeId:g&&g.n.id,nodeT:g&&g.n.t,target:g?'node':'new',focus:'#md-in',...o}); }
const mdOpt=D=>({links:D.linkNote?'note':'field'});
function mdModel(D){ let nodes=[]; try{ nodes=(D.md||'').trim()?IO.parseMarkdown(D.md,mdOpt(D)):[]; }catch{} const count=countNodes(nodes); let tree=null;
  if(D.target==='node') tree={t:D.nodeT,tgt:true,c:nodes}; else if(nodes.length) tree=nodes.length===1?nodes[0]:{...nodes[0],c:[...(nodes[0].c||[]),...nodes.slice(1)]};
  return {tree,count}; }
function updateMdPreview(){ const D=S.dialog, m=mdModel(D); const pv=$('#md-prev'); if(pv) pv.innerHTML=V.mdPreview(m.tree,m.count); const c=$('#md-count'); if(c) c.textContent=`預覽 · 共 ${m.count} 個節點`; const b=$('#md-ok'); if(b){ b.textContent=V.mdOkLabel(D,m.count); b.disabled=!m.count; } }
// ---------- actions ----------
function closePanel(){ const was=S.panel; S.panel=''; render(); const b=was==='style'?$('[data-act="style"]'):was==='history'?$('[data-act="history"]'):null; (b&&b.offsetParent?b:$('#cv'))?.focus(); }
async function act(a,v,el){ const f=selInfo();
  switch(a){
  case 'home': location.hash='#/'; break;
  case 'new': { createMap({t:'中心主題',c:[{t:'主題 1'},{t:'主題 2'},{t:'主題 3'}]}); setTimeout(()=>{ if(S.doc){S.sel=S.doc.root.id; drawAll(); startEdit(S.doc.root.id);} },60); break; }
  case 'nav': document.body.insertAdjacentHTML('beforeend',`<div class="navdrawer" role="dialog" aria-modal="true" aria-label="選單"><div class="scrim2" data-act="navClose"></div><aside class="side">${V.sidebar(S,maps.index())}</aside></div>`); $('.navdrawer .new-btn').focus(); break;
  case 'navClose': $('.navdrawer')?.remove(); break;
  case 'settings': closeMenu(); if(S.dialog) S.dialog=null; openSettings(v||'data'); break;
  case 'settingsA11y': closeMenu(); openSettings('a11y'); break;
  case 'welcomeDrive': openSettings('data',{fromWelcome:true}); S.dialog.form.backend='drive'; drawDialog(); break;
  case 'formBackend': readForm(S.dialog); S.dialog.form.backend=v; S.dialog.driveErr=''; drawDialog(); $(`[data-act="formBackend"][data-v="${v}"]`)?.focus(); break;
  case 'driveConnect': { const D=S.dialog; if(!D||D.driveBusy) break; readForm(D); D.driveBusy=true; D.driveErr=''; drawDialog();
    try{ await GD.signIn({hint:(D.drive&&D.drive.email)||prefs.get().driveEmail||''}); driveC=null; const c=dc(); const u=await c.about(); await c.ensureFolder(); D.drive={email:u.email,name:u.name}; D.driveAuth=false; D.form.backend='drive'; if(D.form.sync==='local'&&!D.syncTouched) D.form.sync='manual';
      if(prefs.get().driveEmail===u.email&&isDrive()){ syncInfo(); render(); } toast(`已連結 ${u.email}`); }
    catch(e){ D.driveErr=e.message; } D.driveBusy=false; if(S.dialog===D){ drawDialog(); $('[data-act="driveDisconnect"],[data-act="driveConnect"]')?.focus(); } break; }
  case 'driveDisconnectNo': { const D=S.dialog; if(D){ D.confirmDisc=false; drawDialog(); $('#layer [data-act="driveDisconnect"]')?.focus(); } break; }
  case 'driveDisconnect': { const D=S.dialog; if(D&&v!=='yes'){ D.confirmDisc=true; drawDialog(); $('#layer [data-act="driveDisconnect"][data-v="yes"]')?.focus(); break; } if(D) D.confirmDisc=false; GD.revoke(); driveC=null; const wasDrive=isDrive(); prefs.set({driveEmail:'',driveName:'',...(wasDrive?{sync:'local'}:{})}); if(D){ D.drive=null; D.driveAuth=false; if(D.form.backend==='drive') D.form.sync='local'; drawDialog(); } syncInfo(); render(); toast('已中斷和 Google 雲端硬碟的連結；圖仍存在這個瀏覽器，雲端上的檔案也還在'); break; }
  case 'welcomeGithub': openSettings('gh',{fromWelcome:true}); break;
  case 'welcomeLocal': prefs.set({mode:'local',sync:'local'}); S.mode='local'; S.syncMode='local'; askPersist(); location.hash='#/'; route(); break;
  case 'closeDialog': closeDialog(); break;
  case 'scrim': if(el===event.target) closeDialog(); break;
  case 'setTab': if(S.dialog.form) readForm(S.dialog); S.dialog.tab=v; drawDialog(); $(`#st-${v}`)?.focus(); break;
  case 'formLines': readForm(S.dialog); S.dialog.form.lines=v; prefs.set({lines:v}); applyUi(); drawDialog(); $(`[data-act="formLines"][data-v="${v}"]`)?.focus(); if(S.doc) drawMap(); break;
  case 'formUi': readForm(S.dialog); S.dialog.form.ui=v; prefs.set({ui:v}); applyUi(); drawDialog(); $(`[data-act="formUi"][data-v="${v}"]`)?.focus(); render(); break;
  case 'formMotion': readForm(S.dialog); S.dialog.form.reduceMotion=!S.dialog.form.reduceMotion; prefs.set({reduceMotion:S.dialog.form.reduceMotion}); applyUi(); drawDialog(); $('[data-act="formMotion"]')?.focus(); break;
  case 'testGithub': { const D=S.dialog; readForm(D); if(!D.form.pat||!D.form.repo){D.test={ok:false,msg:'請填寫儲存庫和金鑰'};return drawDialog();} D.test={ok:true,msg:'測試中…'}; drawDialog();
    try{ const c=client(D.form.pat.trim(),D.form.repo.trim()); const t=await c.test(); let canWrite=t.push; D.test=canWrite?{ok:true,msg:`連線成功 · ${t.private?'私人儲存庫':'⚠ 這是公開儲存庫'} · 可讀寫`}:{ok:false,msg:'可以讀取但沒有寫入權限：請把 Contents 設成 Read and write'}; }
    catch(e){ D.test={ok:false,msg:e.status===401?'金鑰無效或過期（401）':e.status===404?'找不到儲存庫：確認名稱，並確認金鑰有勾選 mymind-data（404）':e.status===0?'網路連線失敗':e.message}; }
    if(S.dialog===D) drawDialog(); break; }
  case 'formSync': readForm(S.dialog); S.dialog.form.sync=v; S.dialog.syncTouched=true; S.dialog.syncErr=null; drawDialog(); $(`[data-act="formSync"][data-v="${v}"]`)?.focus(); break;
  case 'askPersist': { const ok=await storage.persist(); S.dialog&&(S.dialog.persisted=ok); drawDialog(); toast(ok?'瀏覽器已同意保留資料':'瀏覽器沒有同意；記得定期匯出備份'); break; }
  case 'backup': closeMenu(); backupAll(); if(S.dialog) { S.dialog.lastBackup=prefs.get().lastBackup; drawDialog(); } break;
  case 'restore': closeMenu(); { const inp=document.createElement('input'); inp.type='file'; inp.accept='.mymind,.json'; inp.onchange=async()=>{ const f=inp.files[0]; if(!f) return; try{ const d=JSON.parse(await f.text()); if(d.format!=='mymind-backup/1') throw new Error('這不是 MyMind 備份檔'); restoreBackup(d); }catch(e){ toast('還原失敗：'+e.message); } }; inp.click(); } break;
  case 'dismissBackup': prefs.set({backupSnooze:new Date().toISOString()}); render(); break;
  case 'syncNow': closeMenu(); if(!remote()){ openSettings('data'); break; } if(isDrive()&&!GD.hasToken()){ await driveReauth(); break; } await pushNow(); break;
  case 'saveSettings': { const D=S.dialog; readForm(D); const pat=D.form.pat.trim(); const P0=prefs.get(), bk=D.form.backend==='drive'&&!(D.drive&&D.drive.email)&&pat&&!P0.backend?'github':(D.form.backend||'github'), prevBk=P0.backend||'github', wasRemote=remote();
    let sync=D.form.sync; if(bk==='github'&&pat&&!secrets.pat()&&sync==='local'&&!D.syncTouched) sync='manual'; // just connected GitHub: default to manual sync
    if(bk==='github'&&sync!=='local'&&!pat){ D.tab='gh'; D.syncErr='要同步到 GitHub，請先貼上金鑰並按「測試」；或選「只存瀏覽器」。'; drawDialog(); $('#f-pat')?.focus(); break; }
    if(bk==='drive'&&sync!=='local'&&!(D.drive&&D.drive.email)){ D.driveErr='要同步到 Google 雲端硬碟，請先按「連結 Google 雲端硬碟」；或選「只存瀏覽器」。'; drawDialog(); $('[data-act="driveConnect"]')?.focus(); break; }
    // switching backend (or Drive account): pull what the old one has first (best effort), then upload everything to the new one
    const newEmail=bk==='drive'?((D.drive&&D.drive.email)||''):'', migrate=sync!=='local'&&(bk!==prevBk||(bk==='drive'&&newEmail!==(P0.driveEmail||'')))&&maps.index().length>0;
    if(migrate&&wasRemote&&gh()){ try{ await syncNow({push:false,reason:'switch'}); }catch{} }
    prefs.set({backend:bk,driveEmail:bk==='drive'?newEmail:(P0.driveEmail||''),driveName:bk==='drive'?((D.drive&&D.drive.name)||''):(P0.driveName||'')});
    if(migrate){ maps.index().forEach(m=>maps.setMeta(m.id,{sha:null,remote:false,dirty:true})); maps.setDeletes([]); }
    const p={repo:D.form.repo.trim()||'hctsaik/mymind-data',model:D.form.model.trim()||'gpt-4o-mini',sync}; secrets.setPat(pat); secrets.setOpenai(D.form.openai.trim());
    const wasMode=S.mode; p.mode=bk==='drive'&&newEmail?'drive':pat?'github':(S.mode||'local'); prefs.set(p); Object.assign(S,{repo:p.repo,model:p.model,mode:p.mode,syncMode:p.sync});
    if(bk==='github'&&prevBk==='github'&&D.repoBefore&&D.repoBefore!==p.repo){ maps.index().forEach(m=>maps.setMeta(m.id,{sha:null,remote:false,dirty:true})); maps.setDeletes([]); }
    closeDialog(); toast(migrate?`已切換到 ${BN()}：${maps.index().length} 張圖${sync==='auto'?'正在上傳':'會在按「同步」時上傳'}；原本的雲端資料不會刪除`:sync==='local'?'已儲存：只存在這個瀏覽器':sync==='manual'?'已儲存：按「同步」才會上傳':'已儲存：自動同步（每幾分鐘最多一次）'); if(!wasMode) location.hash='#/'; route();
    if(remote()) syncNow({push:sync==='auto',reason:'auto'}); break; }
  case 'clearKeys': { secrets.clear(); prefs.set({sync:'local'}); S.syncMode='local'; S.dialog.form.pat=''; S.dialog.form.openai=''; S.dialog.form.sync='local'; drawDialog(); toast('已清除這個瀏覽器裡的金鑰；圖仍存在這個瀏覽器'); render(); break; }
  case 'undo': undo(); break; case 'redo': redo(); break;
  case 'addChild': closeMenu(); addChild(); break; case 'addSibling': closeMenu(); addSibling(); break; case 'outdent': closeMenu(); outdent(); break;
  case 'edit': closeMenu(); startEdit(S.sel); break;
  case 'nodeMenuTb': { const r=el.getBoundingClientRect(); S.sel&&openNodeMenu(S.sel,r.left+r.width/2,r.bottom); if(MENU) MENU.trigger=el; break; }
  case 'delete': closeMenu(); removeSel(); $('#cv').focus(); break;
  case 'collapse': closeMenu(); toggleCollapse(); break;
  case 'copyNode': { closeMenu(); if(!f||!f.parent) return toast('中心主題不能複製'); const cp=ensureIds(JSON.parse(JSON.stringify(f.n).replace(/"id":"[^"]+",?/g,''))); mutate(r=>{find(r,f.parent.id).n.c.splice(f.idx+1,0,cp);},{select:cp.id}); break; }
  case 'priMenu': closeMenu(); openPriMenu(); break;
  case 'icons': closeMenu(); openIcons(); break;
  case 'emojiCat': if(S.dialog){ S.dialog.cat=v; drawDialog(); $(`#layer [data-act="emojiCat"][data-v="${v}"]`)?.focus(); } break;
  case 'emojiSet': { const D=S.dialog; if(!D||D.type!=='emoji') return; closeDialog(); const id=D.nodeId; if(!find(S.doc.root,id)) return; mutate(r=>{ const x=find(r,id).n; if(v) x.icon=v; else delete x.icon; }); if(v) prefs.set({recentIcons:[v,...(prefs.get().recentIcons||[]).filter(e=>e!==v)].slice(0,16)}); break; }
  case 'olToggle': S.olFocus={id:v}; toggleCollapse(v); break;
  case 'olNote': S.sel=v; S.panel='note'; render(); setTimeout(()=>$('#notearea')?.focus(),30); break;
  case 'olIndent': olOp('indent'); break; case 'olOutdent': olOp('outdent'); break; case 'olUp': olOp('up'); break; case 'olDown': olOp('down'); break; case 'olAdd': olOp('add'); break; case 'olDel': olOp('del'); break;
  case 'linkSave': { const raw=$('#linkin')?.value; const u=normLink(raw); if(u===null){ S.linkErr='請輸入 http 或 https 開頭的網址'; panelRefresh(); $('#linkin')?.focus(); return; } S.linkErr=''; setField('link',u||''); panelRefresh(); if(u) toast('已加入連結'); break; }
  case 'linkDel': S.linkErr=''; setField('link',''); panelRefresh(); break;
  case 'linkFromNote': { if(!f) return; const m=/連結：(https?:\/\/\S+)/.exec(f.n.note||''); if(!m) return; mutate(r=>{ const x=find(r,f.n.id).n; x.link=m[1]; const rest=x.note.replace(m[0],'').replace(/\n{2,}/g,'\n').trim(); if(rest) x.note=rest; else delete x.note; }); panelRefresh(); toast('已設成節點連結'); break; }
  case 'tagAdd': addTag($('#tagin')?.value); break;
  case 'tagAddV': addTag(v); break;
  case 'tagDel': if(!f) return; mutate(r=>{ const x=find(r,f.n.id).n; const t=tagsOfN(x).filter(k=>k!==v); delete x.tag; if(t.length) x.tags=t; else delete x.tags; }); panelRefresh(); break;
  case 'color': if(!f) return; if(!f.parent) return toast('中心主題使用主題顏色'); mutate(r=>{ const x=find(r,f.n.id).n; if(v==='') delete x.color; else x.color=+v; }); panelRefresh(); break;
  case 'imgPick': { if(!f) return; const id=f.n.id, inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=()=>{ const file=inp.files[0]; if(file) setImageFromBlob(id,file); }; inp.click(); break; }
  case 'imgUrl': { if(!f) return; const u=normLink($('#imgurl')?.value); if(!u){ S.imgErr='請輸入 https 開頭的圖片網址'; panelRefresh(); return; } const id=f.n.id; const im=new Image(); im.onload=()=>{ mutate(r=>{ find(r,id).n.img={src:u,w:im.naturalWidth,h:im.naturalHeight}; }); S.imgErr=''; panelRefresh(); toast('已加入圖片（外部網址）'); }; im.onerror=()=>{ S.imgErr='讀不到這張圖片，請確認網址是圖片檔'; panelRefresh(); }; im.src=u; break; }
  case 'imgDel': setField('img',''); S.imgErr=''; panelRefresh(); break;
  case 'note': closeMenu(); if(!S.doc) return; if(!f) return toast('先選一個節點'); S.panel=S.panel==='note'?'':'note'; render(); if(S.panel){ setTimeout(()=>revealAboveSheet(S.sel),isM()?320:20); if(!isM()) setTimeout(()=>$('#notearea')?.focus(),30); } break;
  case 'deleteNote': setField('note',''); S.panel=''; render(); break;
  case 'style': closeMenu(); S.panel=S.panel==='style'?'':'style'; render(); if(S.panel&&S.doc&&isM()) setTimeout(()=>revealAboveSheet(S.sel||S.doc.root.id),320); if(S.panel) setTimeout(()=>$('#panelHost [role=tab][aria-selected=true]')?.focus(),30); break;
  case 'history': closeMenu(); S.panel=S.panel==='history'?'':'history'; S.preview=null; render(); if(S.panel) loadHistory(); break;
  case 'closePanel': closePanel(); break;
  case 'tab': S.tab=v; drawPanel(); $(`#st-${v}`)?.focus(); break;
  case 'theme': S.doc.theme=v; touch(); render(); break;
  case 'randomTheme': { const ks=Object.keys(THEMES).filter(k=>k!==S.doc.theme); S.doc.theme=ks[Math.floor(Math.random()*ks.length)]; touch(); render(); toast('主題：'+THEMES[S.doc.theme].name,['復原','undoTheme']); S.prevTheme=S.prevTheme; break; }
  case 'edge': case 'lw': case 'spacing': S.doc.settings={...(S.doc.settings||{}),[a]:v}; touch(); break;
  case 'layout': S.doc.settings={...(S.doc.settings||{}),layout:v}; S.vp=null; S.vpFor=null; touch(); drawAll(true); setTimeout(()=>$(`#panelHost [data-act="layout"][data-v="${v}"]`)?.focus(),20); break;
  case 'rootTop': S.doc.settings={...(S.doc.settings||{}),rootTop:v==='1'}; S.vpFor=null; touch(); drawMap(true); break;
  case 'minimap': S.minimap=!S.minimap; prefs.set({minimap:S.minimap}); render(); break;
  case 'hints': S.hints=!S.hints; prefs.set({hints:S.hints}); render(); break;
  case 'hl': setField('hl',v==='none'?'':v); break;
  case 'done': setField('done',!(f&&f.n.done)); break;
  case 'pri': closeMenu(); setField('pri',+v); break;
  case 'icon': setField('icon',v); break;
  case 'level': closeMenu(); setLevel(+v); break;
  case 'zoomIn': zoomAt(1.2); updMenuPct(); break; case 'zoomOut': zoomAt(1/1.2); updMenuPct(); break;
  case 'fit': closeMenu(); fit(); break;
  case 'outline': closeMenu(); if(S.outline&&S.olId&&S.doc&&find(S.doc.root,S.olId)) S.sel=S.olId; S.outline=!S.outline; if(S.outline&&S.find) closeFind(); render(); if(S.outline) setTimeout(()=>olFocus(S.sel||S.doc.root.id),30); else { ensureVisible(S.sel); $('#cv')?.focus(); } break;
  case 'olSelect': S.outline=false; S.sel=v; render(); ensureVisible(v); $('#cv').focus(); break;
  case 'shortcuts': closeMenu(); openDialog({type:'shortcuts'}); break;
  case 'moreMenu': openMoreMenu(el); break;
  case 'exportMenu': closeMenu(); openExportMenu(el&&el.closest('.right-actions')?el:$('.right-actions')); break;
  case 'exp': closeMenu(); exportAs(v); break;
  case 'install': { closeMenu(); const ev=PWA.prompt; if(!ev) return toast('請用瀏覽器選單的「安裝應用程式／加到主畫面」'); PWA.prompt=null; S.canInstall=false; ev.prompt(); try{ const r=await ev.userChoice; if(r&&r.outcome==='dismissed') toast('已取消安裝，之後可以從「⋯」選單再安裝'); }catch{} render(); break; }
  case 'installLater': prefs.set({installHide:new Date().toISOString()}); syncInfo(); render(); break;
  case 'swReload': swReload(); break;
  case 'swLater': $('#updbar')?.remove(); PWA.later=true; break;
  case 'find': if(S.find&&isM()) closeFind(); else openFind(); break;
  case 'findNext': goFind((S.find?.i??-1)+1); break;
  case 'findPrev': goFind((S.find?.i??1)-1); break;
  case 'findClose': closeFind(); break;
  case 'copyMd': { closeMenu(); if(!S.doc) return; const g=f||{n:S.doc.root,parent:null}; copyPayload(clipPayload(g.n,!g.parent),copyMsg(g.n)); break; }
  case 'pasteMd': closeMenu(); openMd({}); break;
  case 'mdImport': closeMenu(); openMd({}); break;
  case 'welcomeMd': prefs.set({mode:'local',sync:'local'}); S.mode='local'; S.syncMode='local'; askPersist(); location.hash='#/'; route(); openMd({target:'new'}); break;
  case 'mdTarget': if(S.dialog){ S.dialog.target=v; drawDialog(); $('#layer .dlg [data-act="mdTarget"][aria-checked="true"]')?.focus(); } break;
  case 'mdPick': pickFile((text,name)=>{ if(S.dialog&&S.dialog.type==='md'){ S.dialog.md=text; drawDialog(); $('#md-in')?.focus(); } }); break;
  case 'mdClip': { const D=S.dialog; try{ const t=await navigator.clipboard.readText(); if(D&&S.dialog===D){ D.md=t; drawDialog(); $('#md-in')?.focus(); } }catch{ toast('瀏覽器不允許直接讀取剪貼簿，請在框內按 Ctrl+V（手機長按）貼上'); $('#md-in')?.focus(); } break; }
  case 'mdOk': { const D=S.dialog; if(!D||D.type!=='md'||!(D.md||'').trim()) return; let nodes; try{ nodes=IO.nodesFromMarkdown(D.md,mdOpt(D)); }catch(e){ return toast('看不懂這段 Markdown：'+e.message); }
    if(!nodes.length) return; if(D.target==='node'&&S.doc&&find(S.doc.root,D.nodeId)){ closeDialog(); pasteNodes(D.nodeId,nodes); }
    else { closeDialog(); const root=IO.fromMarkdown(D.md,mdOpt(D)); createMap(root); toast(`已建立「${root.t}」，共 ${allDeep(root).length} 個節點`); } break; }
  case 'pasteEditNodes': { const P=S.pasteEdit; S.pasteEdit=null; $('#toast')?.classList.remove('on'); if(!P||!S.doc) return; const nodes=IO.fromClipboardHTML(P.html)||IO.nodesFromMarkdown(P.txt); if(!nodes.length) return;
    if(S.editing&&S.editing.id===P.id){ const ta=$('#ovl .editbox'); if(ta) ta.value=P.before.trim()?P.before:' '; commitEdit(); }
    const g=find(S.doc.root,P.id); if(!g) return; pasteNodes(P.id,nodes,{replace:!P.before.trim()&&!!g.parent}); break; }
  case 'import': closeMenu(); pickFile(); break;
  case 'ai': closeMenu(); openAI('topic'); break;
  case 'aiNotes': openAI('notes'); break;
  case 'aiExpand': closeMenu(); if(!S.doc) return openAI('topic'); openAI('expand'); break;
  case 'aiTab': ['topic','notes','hint'].forEach(k=>{const e2=document.querySelector(`[data-ai="${k}"]`); if(e2) S.dialog[k]=e2.value;}); S.dialog.tab=v; S.dialog.error=null; drawDialog(); $(`#ait-${v}`)?.focus(); break;
  case 'aiRun': runAI(); break;
  case 'aiCancel': S.dialog.ctrl&&S.dialog.ctrl.abort(); break;
  case 'aibarClose': S.aibar=false; render(); break;
  case 'cfPick': S.dialog.pick=v; drawDialog(); $(`[data-act="cfPick"][data-v="${v}"]`)?.focus(); break;
  case 'cfApply': applyConflict(); break;
  case 'preview': preview(v); break; case 'endPreview': endPreview(); break; case 'restore': restorePreview(); break;
  case 'promptOk': { const D=S.dialog; const val=D.input!==undefined?$('#pr-in').value:true; D.onClose=null; S.dialog=null; drawDialog(); D.resolve(val); break; }
  case 'cardMenu': openCardMenu(v,el); break;
  case 'openMap': closeMenu(); location.hash='#/map/'+v; break;
  case 'renameMap': { closeMenu(); const d=maps.load(v); const t=await askText('重新命名','名稱',d.root.t); if(t&&t.trim()){ d.root.t=t.trim(); d.updated=new Date().toISOString(); storeDoc(d); changed(); render(); } break; }
  case 'dupMap': { closeMenu(); const d=maps.load(v); const cp=clone(d); cp.id=newId(); cp.root.t=d.root.t+'（副本）'; cp.created=cp.updated=new Date().toISOString(); storeDoc(cp); changed(); render(); toast('已建立副本'); break; }
  case 'starMap': { closeMenu(); const d=maps.load(v); d.star=!d.star; storeDoc(d); changed(); render(); break; }
  case 'expMapMd': closeMenu(); exportAs('md',maps.load(v)); break;
  case 'trashMap': { closeMenu(); const d=maps.load(v); d.trashed=true; d.trashedAt=new Date().toISOString(); storeDoc(d); changed(); render(); toast('已移到垃圾桶',['還原','undoTrash:'+v]); break; }
  case 'restoreMap': { closeMenu(); const d=maps.load(v); delete d.trashed; delete d.trashedAt; storeDoc(d); changed(); render(); toast('已還原'); break; }
  case 'purgeMap': { closeMenu(); const ok=await confirmBox('永久刪除這張圖？','「'+maps.meta(v).title+'」會從這個瀏覽器刪除'+(maps.meta(v).remote?'；下次同步時也會從 GitHub 儲存庫刪除（舊版本仍留在 git 歷史裡）':'')+'。','永久刪除',true); if(!ok) return;
    const m=maps.meta(v); if(m.remote) maps.setDeletes([...maps.deletes(),v]); maps.remove(v); changed(); render(); toast('已永久刪除'); break; }
  case 'clearSearch': S.q=''; render(); $('#homeq')?.focus(); break;
  case 'sort': S.sort=v; render(); break;
  case 'closeMenu': closeMenu(true); break;
  case 'undoTheme': undo(); break;
  default: if(a.startsWith('undoTrash:')) act('restoreMap',a.split(':')[1]);
  } }
function updMenuPct(){ const p=document.querySelector('.mmenu .pctb'); if(p) p.textContent=Math.round(S.vp.sc*100)+'%'; }
function readForm(D){ $$('[data-form]').forEach(i=>D.form[i.dataset.form]=i.value); }
// a long-press opens the node menu under the finger; ignore the click the finger's release may fire
document.addEventListener('pointerup',()=>{ if(MENU&&MENU.lp&&!MENU.lpUp) MENU.lpUp=Date.now(); },true);
document.addEventListener('click',e=>{ const el=e.target.closest('[data-act]'); if(!el) return; if(MENU&&MENU.lpUp&&Date.now()-MENU.lpUp<350&&el.closest('#layer')) { e.preventDefault(); return; } if(el.tagName==='A'&&el.getAttribute('href')&&!el.dataset.act) return; const a=el.dataset.act; if(a==='scrim'&&e.target!==el) return; if(a==='closeMenu'){closeMenu(true);return;} e.preventDefault(); if($('.navdrawer')&&a!=='nav'&&!el.closest('.navdrawer .side')?.matches('x')) {} act(a,el.dataset.v,el); });
document.addEventListener('click',e=>{ if($('.navdrawer')&&e.target.closest('.navdrawer a')) setTimeout(()=>$('.navdrawer')?.remove(),0); });
document.addEventListener('input',e=>{ const t=e.target; const k=t.dataset.input;
  if(k==='q'){ S.q=t.value; const pos=t.selectionStart; render(); const n=$('#homeq'); if(n){n.focus();n.setSelectionRange(pos,pos);} }
  else if(k==='sideQ'){ S.sideQ=t.value; const pos=t.selectionStart; const inDrawer=!!t.closest('.navdrawer'); const host=inDrawer?$('.navdrawer .side'):$('#side'); host.innerHTML=V.sidebar(S,maps.index()); const n=host.querySelector('#sideq'); n.focus(); n.setSelectionRange(pos,pos); }
  else if(t.classList.contains('olin')){ const id=t.dataset.olid, x=S.doc&&find(S.doc.root,id); if(!x||S.preview) return; if(t._snapFor!==id){ S.undo.push(JSON.stringify(S.doc.root)); if(S.undo.length>100) S.undo.shift(); S.redo=[]; t._snapFor=id; } x.n.t=t.value; clearTimeout(olT); olT=setTimeout(quietSave,400); }
  else if(k==='emojiQ'&&S.dialog){ S.dialog.q=t.value; const g=$('#emgrid'); if(g) g.innerHTML=V.emojiGrid(V.emojiList(S.dialog),(find(S.doc.root,S.dialog.nodeId)||{n:{}}).n.icon); $('#layer .emcats')?.toggleAttribute('hidden',!!t.value.trim()); $('#layer .emrow')?.toggleAttribute('hidden',!!t.value.trim()); }
  else if(k==='find'&&S.find){ S.find.q=t.value; S.find.i=0; goFind(0); }
  else if(k==='mdText'&&S.dialog&&S.dialog.type==='md'){ S.dialog.md=t.value; updateMdPreview(); }
  else if(k==='note'){ clearTimeout(t._t); t._t=setTimeout(()=>{ const f=selInfo(); if(!f) return; const v=t.value; mutate(r=>{const x=find(r,f.n.id).n; if(v.trim()) x.note=v; else delete x.note;}); },400); } });
document.addEventListener('change',e=>{ const t=e.target; if(t.dataset.input==='sort'){ S.sort=t.value; render(); } if(t.dataset.ai&&S.dialog) S.dialog[t.dataset.ai]=t.value; if(t.dataset.md==='linkNote'&&S.dialog){ S.dialog.linkNote=!t.checked; updateMdPreview(); } });
document.addEventListener('keydown',e=>{ // roving tabindex for tablists
  const t=e.target; if(t.getAttribute&&t.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){ const tabs=[...t.closest('[role=tablist]').querySelectorAll('[role=tab]')]; let i=tabs.indexOf(t); i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length; e.preventDefault(); e.stopPropagation(); tabs[i].click(); }
  if(t.matches&&t.matches('.hist li[role=button]')&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); t.click(); } },true);
let rT; addEventListener('resize',()=>{ clearTimeout(rT); rT=setTimeout(()=>{ shellKey=''; render(); },150); });
addEventListener('hashchange',route);
// boot
// ---------- PWA (v1.3): offline shell, install prompt, update prompt ----------
const PWA={prompt:null,reg:null,reloading:false,later:false,newVersion:''};
window.__mmVersion=VERSION;
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); PWA.prompt=e; S.canInstall=true; if(S.view==='list') render(); });
window.addEventListener('appinstalled',()=>{ PWA.prompt=null; S.canInstall=false; if(S.view==='list') render(); toast('已安裝 MyMind，可以從主畫面開啟'); });
function showUpdate(){ if(PWA.later||$('#updbar')) return; document.body.insertAdjacentHTML('beforeend',V.updateBar(PWA.newVersion)); }
async function swReload(){ const w=PWA.reg&&PWA.reg.waiting; if(S.editing) commitEdit(); try{ await storage.flush(); }catch{} PWA.reloading=true; $('#updbar')?.remove();
  if(w) w.postMessage({type:'SKIP_WAITING'}); else location.reload(); setTimeout(()=>location.reload(),4000); }
function askVersion(w){ try{ w.postMessage({type:'VERSION'}); }catch{} }
if('serviceWorker' in navigator&&(location.protocol==='https:'||/^(localhost|127\.0\.0\.1)$/.test(location.hostname))&&!/[?&]nosw\b/.test(location.search)){
  navigator.serviceWorker.addEventListener('message',e=>{ if(e.data&&e.data.type==='VERSION'&&e.data.version!==VERSION){ PWA.newVersion=e.data.version; const b=$('#updbar'); if(b) b.outerHTML=V.updateBar(PWA.newVersion); } });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(PWA.reloading) location.reload(); });
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').then(reg=>{ PWA.reg=reg; window.__mmPWA=PWA;
    const waiting=w=>{ if(navigator.serviceWorker.controller){ askVersion(w); showUpdate(); } };
    if(reg.waiting) waiting(reg.waiting);
    reg.addEventListener('updatefound',()=>{ const w=reg.installing; w&&w.addEventListener('statechange',()=>{ if(w.state==='installed') waiting(w); }); });
    const check=()=>reg.update().catch(()=>{}); setInterval(check,30*60e3); document.addEventListener('visibilitychange',()=>{ if(!document.hidden) check(); });
  }).catch(e=>console.warn('service worker:',e.message)); });
}
(async()=>{ await storage.init(); syncInfo(); applyUi(); route(); document.body.dataset.ready='1'; if(maps.index().length) askPersist(); if(remote()) syncAll(); })();
window.__mmStore={maps,storage,flush:()=>storage.flush(),syncNow:o=>syncNow(o),changed:()=>{ changed(); drawChrome(); }}; // test hooks (no secrets)
