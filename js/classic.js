// 經典蜜桃 (classic) engine: a right-logic layout and look for the classic peach outline style.
// Measured rules: font sizes 26/16/14 at line-height 1.2, paddings [16,24]/[10,15]/[6,9], 17px minimum content,
// margins 50/30/20 (+4 with children, collapsed between siblings), gaps to children 51/31/26, fork-rounded connectors
// (stub, spine, corner radius ≤17 with the .552/.75 smoothing), parent anchored on its children's first/last
// mid-point snapping to a middle child (or pair) within 12px, drag offsets applied after centring, any number of lines.
// Pure functions: data in, SVG string out. Only used when a theme sets engine:'classic'.
import { esc } from './core.js';
const mctx=document.createElement('canvas').getContext('2d');
export const CFF='"PingFang SC","MMC Open Sans","MMC Han Sans"';
// fonts: PingFang SC where the system has it (Apple), else Open Sans + Noto Sans SC (css/classic-fonts.css, loaded on first use).
// When a face finishes loading, measurements are dropped and 'mm-classic-fonts' fires so the map is laid out again.
let fontsAsked=null;
function askFonts(){ if(fontsAsked) return fontsAsked; if(typeof document==='undefined') return (fontsAsked=Promise.resolve());
  fontsAsked=new Promise(res=>{ let l=document.querySelector('link[data-classic-fonts]'); if(l) return res();
    l=document.createElement('link'); l.rel='stylesheet'; l.href=new URL('../css/classic-fonts.css',import.meta.url).href; l.dataset.classicFonts='1'; l.onload=l.onerror=()=>res(); document.head.appendChild(l); });
  fontsAsked.then(()=>{ twc.clear(); metc.clear(); dispatchEvent(new Event('mm-classic-fonts')); });
  if(document.fonts&&document.fonts.addEventListener) document.fonts.addEventListener('loadingdone',()=>{ twc.clear(); metc.clear(); dispatchEvent(new Event('mm-classic-fonts')); });
  return fontsAsked; }
export function classicFontsReady(text='中Ag'){ return askFonts().then(()=>{ if(!document.fonts) return;
  return Promise.all(['400 14px','700 16px','700 26px'].map(f=>document.fonts.load(`${f} ${CFF}`,text))).then(()=>document.fonts.ready).then(()=>{ twc.clear(); metc.clear(); }); }); }
const twc=new Map();
// CJK punctuation keeps its full em box (text-spacing-trim:space-all) like the source app's text; canvas measuring would trim adjacent pairs such as 」。
const CJKP=/[\u3000-\u303F\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\u2018-\u201F\u2025\u2026\u30FB]/; let twSpan=null;
const tw=(s,font)=>{ askFonts(); const k=font+'|'+s; let v=twc.get(k); if(v===undefined){
    if(CJKP.test(s)&&typeof document!=='undefined'&&document.body){ if(!twSpan){ twSpan=document.createElement('span'); twSpan.setAttribute('aria-hidden','true'); twSpan.style.cssText='position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;text-spacing-trim:space-all;line-height:1.2'; document.body.appendChild(twSpan); } twSpan.style.font=font; twSpan.style.textSpacingTrim='space-all'; twSpan.textContent=s; v=twSpan.getBoundingClientRect().width; }
    else { mctx.font=font; v=mctx.measureText(s).width; }
    twc.set(k,v); if(twc.size>20000) twc.clear(); } return v; };
const metc=new Map();
function metrics(font){ let m=metc.get(font); if(!m){ mctx.font=font; const t=mctx.measureText('中Hg'); m={a:Math.round(t.fontBoundingBoxAscent||0), d:Math.round(t.fontBoundingBoxDescent||0)}; metc.set(font,m); } return m; }
const u64=v=>Math.ceil(v*64-1e-6)/64, f64=v=>Math.floor(v*64+1e-6)/64;
// ---------- style spec ----------
// A map may carry its own resolved look in root.gs (from an import): background, text width limit, layout, three level
// styles (root / main / sub), an optional branch palette and image assets. Without it the peach look below is used.
// Each node may override any level key in n.gs.
const LV0={fs:26,fw:'bold',color:'#fff',fill:'#ffbb91',stroke:'transparent',sw:0,r:8,shape:'arc-sides-rect',pad:[16,24],m:[50],conn:'fork-rounded',cc:'#ff8e6e',cw:2,align:'center',lh:1.2};
const LV1={fs:16,fw:'bold',color:'#000',fill:'#fff',stroke:'#ffbb91',sw:2,r:10,shape:'rect',pad:[10,15],m:[30],conn:'fork-rounded',cc:'#ff8e6e',cw:2,align:'left',lh:1.2};
const LV2={fs:14,fw:'normal',color:'#000',fill:'transparent',stroke:'transparent',sw:0,r:5,shape:'rect',pad:[6,9],m:[20],conn:'fork-rounded',cc:'#ff8e6e',cw:2,align:'left',lh:1.2};
export const DEFSPEC={bg:'#FFF1E6',maxW:2560,layout:'right',lv:[LV0,LV1,LV2],multi:null,assets:{}};
const specCache=new WeakMap();
export function specOf(root){ const g=root&&root.gs; if(!g||typeof g!=='object') return DEFSPEC; let s=specCache.get(g); if(s) return s;
  const lv=[0,1,2].map(i=>({...[LV0,LV1,LV2][i],...((g.lv||[])[i]||{})}));
  s={...DEFSPEC,...g,lv,assets:g.assets||{}}; specCache.set(g,s); return s; }
const LEVEL_FS=[26,16,14];
export const lvOf=d=>{ const L=[LV0,LV1,LV2][Math.min(d,2)]; return {fs:L.fs,fw:L.fw==='bold'?700:400,py:L.pad[0],px:L.pad[1],m:L.m[0],hg:[51,31,26][Math.min(d,2)],out:[16.65,14,13][Math.min(d,2)]}; };
const famOf=s=>s.ff?`"${String(s.ff).replace(/"/g,'')}",${CFF}`:CFF;
const fontOfS=s=>`${s.fi?'italic ':''}${s.fw==='bold'||+s.fw>=600?700:400} ${s.fs}px ${famOf(s)}`;
export const fontOfC=d=>{ const L=[LV0,LV1,LV2][Math.min(d,2)]; return fontOfS(L); };
export const PRI_C=['#e64248','#f9b62a','#5565fb','#bb3aac','#2bcc5b','#25b7e6','#80acb4','#83989b','#8e9698'];
const kids=n=>(n.collapsed||!n.c)?[]:n.c;
const ICON_GAP=6, BGAP=5, priB=fs=>Math.round(fs*1.2) /* priority badge box: 17 at 14px, 19 at 16px */, FIX=12, LINK_W=20, LINK_GAP=4;
const isNone=c=>!c||c==='transparent'||c==='none';
export const foldOf=s=>isNone(s.stroke)?0:Math.ceil(Math.max(0,(+s.sw||0)/2));
// resolved style of one node: level style, branch palette, then the node's own overrides
function styleFor(n,d,br,S){ const L=S.lv[Math.min(d,2)]; const s={...L};
  if(S.multi&&d>=1&&Array.isArray(S.multi.pal)&&S.multi.pal.length){ const c=S.multi.pal[br%S.multi.pal.length];
    if(S.multi.conn!==false){ s.cc=c; if(!isNone(s.stroke)||d>=1) s.stroke=c; }
    if(d===1&&S.multi.fill) s.fill=c; }
  if(n.gs&&typeof n.gs==='object') Object.assign(s,n.gs);
  if(n.shape==='arc'&&!(n.gs&&n.gs.shape)) s.shape='arc-sides-rect';
  return s; }
// text wrapping at the map's text width limit, measured by the browser's own line breaking (same rules as HTML text)
let wrapDiv=null; const wrapc=new Map();
function wrapLine(line,font,maxW){ const k=font+'|'+maxW+'|'+line; let v=wrapc.get(k); if(v) return v;
  if(typeof document==='undefined'||!document.body){ return [line]; }
  if(!wrapDiv){ wrapDiv=document.createElement('div'); wrapDiv.setAttribute('aria-hidden','true'); wrapDiv.style.cssText='position:absolute;left:-99999px;top:0;visibility:hidden;display:inline-block;width:max-content;word-break:break-word;white-space:normal;line-height:1.2;tab-size:4;text-spacing-trim:space-all'; document.body.appendChild(wrapDiv); }
  wrapDiv.style.font=font; wrapDiv.style.lineHeight='1.2'; wrapDiv.style.maxWidth=maxW+'px'; wrapDiv.textContent=line;
  const tn=wrapDiv.firstChild, out=[]; if(!tn){ wrapc.set(k,[line]); return [line]; }
  const r=document.createRange(); let cur='', top=null; const chars=[...line]; let off=0;
  for(const ch of chars){ r.setStart(tn,off); r.setEnd(tn,off+ch.length); const rects=r.getClientRects(); const t=rects.length?rects[rects.length-1].top:top;
    if(top!==null&&t>top+1&&cur){ out.push(cur); cur=''; } if(t!=null) top=t; cur+=ch; off+=ch.length; }
  if(cur) out.push(cur); v=out.map(l=>l.replace(/[ \t]+$/,'').replace(/^[ \t]+/,'')).filter((l,i,a)=>l.length||a.length===1);
  wrapc.set(k,v); if(wrapc.size>5000) wrapc.clear(); return v; }
const iconBox=fs=>Math.round(fs*1.2)+4;
// a sticker (asset) or a picture shown above the text, at its stored size
function mediaOf(n,S){ if(n.gst&&n.gst.w&&(S.assets[n.gst.k]||n.gst.src)) return {w:+n.gst.w,h:+n.gst.h,src:S.assets[n.gst.k]||n.gst.src,kind:'sticker'};
  if(S!==DEFSPEC&&n.img&&n.img.src&&n.img.w&&n.img.h) return {w:+n.img.w,h:+n.img.h,src:n.img.src,kind:'image'}; return null; }
function size(n,d,br,par,S){
  n.d=d; n.br=br; n.parent=par||null; n.side=d===0?0:(par&&par.d===0?1:par?par.side:1);
  const s=styleFor(n,d,br,S); n.st=s; const L=S.lv[Math.min(d,2)];
  const F=fontOfS(s), t=n.t==null?'':String(n.t);
  let lines=t.split('\n').map(l=>l.replace(/[ \t\r]+/g,' ').replace(/^ | $/g,'')); // shown like HTML text: runs of spaces collapse, line ends trim
  if(!S.keepNbsp) lines=lines.map(l=>l.replace(/\u00A0+/g,' ').replace(/ +/g,' ').trim());
  const maxW=S.maxW||400, wrapped=lines.some(l=>tw(l,F)>maxW); if(wrapped) lines=lines.flatMap(l=>tw(l,F)>maxW?wrapLine(l,F,maxW):[l]);
  n.lines=lines; n.fs=s.fs; n.font=F; n.lhC=f64(s.fs*(s.lh||1.2));
  const adapt=s.fs!==L.fs?s.fs/L.fs:1, pad=(s.pad||L.pad).map(p=>adapt===1?p:Math.round(p*adapt)); const py=pad[0], px=pad[1]!=null?pad[1]:pad[0];
  // a wrapped paragraph fills the whole max width (inline-block, width:max-content clamped by max-width)
  const txw=wrapped?maxW:u64(Math.max(0,...lines.map(l=>tw(l,F)))), txh=lines.length*n.lhC;
  const mn=Math.round(s.fs*(s.lh||1.2));
  let cw=txw, ch=txh; n.txw=txw; n.txh=txh;
  const icons=Array.isArray(n.gi)?n.gi:[]; n.ic=iconBox(s.fs);
  if(n.icon&&!icons.length){ cw+=21+ICON_GAP; ch=Math.max(ch,21); n.ic=21; }
  icons.forEach(()=>{ cw+=n.ic+ICON_GAP; ch=Math.max(ch,n.ic); });
  if(n.pri){ const B=priB(s.fs); cw+=B+BGAP; ch=Math.max(ch,B); }
  if(n.link&&S!==DEFSPEC){ cw+=LINK_GAP+LINK_W; ch=Math.max(ch,LINK_W); }
  n.rowW=cw; n.rowH=ch; n.media=null;
  const med=mediaOf(n,S); if(med){ n.media=med; n.mgap=Math.round(s.fs/2); cw=Math.max(cw,med.w); ch=ch+med.h+n.mgap; }
  cw=Math.max(cw,mn); ch=Math.max(ch,mn);
  const W0=cw+2*px, H=ch+2*py; n.arc=s.shape==='arc-sides-rect';
  n.w=n.arc?W0-py/2+H/2:W0; n.h=H; n.padX=px; n.padY=py; n.cw=cw; n.ch=ch; n.fold=foldOf(s);
  (n.c||[]).forEach((c,i)=>size(c,d+1,d===0?i:br,n,S));
}
function anchor(ys){ const t=(ys[0]+ys[ys.length-1])/2; if(ys.length<=2) return t;
  let i=Infinity,o=null; for(let c=1;c<ys.length-1;c++){ const n=Math.abs(ys[c]-t); if(!(n<i)) break; i=n; o=ys[c]; }
  let a=Infinity,s=null; for(let c=0;c<ys.length-1;c++){ const m=(ys[c]+ys[c+1])/2, dd=Math.abs(m-t); if(!(dd<a)) break; a=dd; s=m; }
  const l=Math.min(i,a); return l<FIX?(i===l?o:s):t; }
const offOf=n=>n.off&&typeof n.off==='object'?{x:Math.max(0,+n.off.x||0),y:+n.off.y||0}:{x:0,y:0};
const mV=s=>s.m[0], mH=s=>s.m.length>1?s.m[1]:s.m[0];
// vertical extents include the stroke fold (an underline only has it below); children line up on their in points
// (box centre, or the underline) and the group is anchored on the parent's out point
const ulOf=n=>n.st&&n.st.shape==='underline';
function stackList(n,k){ let y=0, prev=null; const ys=[];
  k.forEach(c=>{ if(prev) y+=Math.max(prev.mv,c.mv); c.ry=y-c.top; ys.push(c.ry+c.inY); y=c.ry+c.bot; prev=c; });
  const an=anchor(ys); let top=n.otop, bot=n.obot;
  k.forEach(c=>{ c.ry+=offOf(c).y-an+n.outY; top=Math.min(top,c.ry+c.top); bot=Math.max(bot,c.ry+c.bot); }); return {top,bot}; }
function stack(n){ const k=kids(n); n.mv=mV(n.st)+(k.length?4:0);
  n.inY=n.outY=ulOf(n)?n.h/2:0; n.otop=-n.h/2-(ulOf(n)?0:n.fold); n.obot=n.h/2+n.fold;
  k.forEach(stack);
  if(!k.length){ n.top=n.otop; n.bot=n.obot; return; }
  if(n.d===0&&n.mind){ const R=k.filter(c=>c.side!==-1), Lf=k.filter(c=>c.side===-1); let top=n.otop, bot=n.obot;
    [R,Lf].forEach(g=>{ if(!g.length) return; const b=stackList(n,g); top=Math.min(top,b.top); bot=Math.max(bot,b.bot); }); n.top=top; n.bot=bot; return; }
  const b=stackList(n,k); n.top=b.top; n.bot=b.bot; }
export const stubOf=s=>Math.max(mH(s)*.333,13);
export const gapOf=(p,c)=>Math.max(mH(p.st),stubOf(p.st)+13)+p.fold+c.fold;
function place(n,x,y){ n.x=x; n.y=y; kids(n).forEach(c=>{ const sg=c.side===-1?-1:1; place(c,x+sg*(n.w/2+gapOf(n,c)+c.w/2+offOf(c).x),y+c.ry); }); }
function setSide(n,s){ n.side=s; (n.c||[]).forEach(c=>setSide(c,s)); }
export function clLayout(root){ const S=specOf(root); size(root,0,0,null,S);
  const k=root.c||[]; root.mind=S.layout==='mind';
  if(root.mind){ const cut=Math.min(k.length,root.split!=null?+root.split:Math.ceil(k.length/2)); k.forEach((c,i)=>setSide(c,i<cut?1:-1)); }
  stack(root); place(root,0,0); root.layout=root.mind?'balanced':'right'; root.cl=true; root.boxed=false; root.spec=S; return root; }
// ---------- geometry ----------
const F3=v=>{ const s=(Math.round(v*1000)/1000).toString(); return s==='-0'?'0':s; };
const mixP=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
const ctl=(len,r)=>{ const e=Math.max(0,len), o=1-e/(e+r+1e-4); return .552*o+.75*(1-o); };
// rounded rect with the smoothed corner curve: every side shortened by r at both ends
export function smoothRect(cx,cy,W,H,r){ r=Math.min(r,W/2,H/2); const x0=cx-W/2,x1=cx+W/2,y0=cy-H/2,y1=cy+H/2, ch=ctl(W-2*r,r), cv=ctl(H-2*r,r);
  const C=(a,q,b,ca,cb)=>{ const p1=mixP(a,q,ca), p2=mixP(b,q,cb); return `C${F3(p1[0])} ${F3(p1[1])} ${F3(p2[0])} ${F3(p2[1])} ${F3(b[0])} ${F3(b[1])}`; };
  return `M${F3(x0)} ${F3(y1-r)} L${F3(x0)} ${F3(y0+r)} ${C([x0,y0+r],[x0,y0],[x0+r,y0],cv,ch)} L${F3(x1-r)} ${F3(y0)} ${C([x1-r,y0],[x1,y0],[x1,y0+r],ch,cv)} L${F3(x1)} ${F3(y1-r)} ${C([x1,y1-r],[x1,y1],[x1-r,y1],cv,ch)} L${F3(x0+r)} ${F3(y1)} ${C([x0+r,y1],[x0,y1],[x0,y1-r],ch,cv)} Z`; }
// pill with arc sides (both sides together are H*0.5 wide), corners smoothed with r
export function arcSides(cx,cy,W,H,r=8){ const o=H/2, S2=H/4, a=Math.max(0,(W-H/2)/2), R=o/Math.sin(2*Math.atan2(S2,o)), acx=-a-S2+R;
  const th0=Math.atan2(-o,-a-acx), arcLen=R*Math.abs(Math.PI-Math.abs(th0))*2; r=Math.min(r,a,arcLen/2);
  const th=th0-r/R, P=[acx+R*Math.cos(th),R*Math.sin(th)], T=[Math.sin(th),-Math.cos(th)]; // tangent going down-left
  const k=(-o-P[1])/T[1], Q=[P[0]+T[0]*k,-o]; // tangent meets the top edge
  const cT=ctl(2*a-2*r,r), cA=ctl(arcLen-2*r,r), top=[-a+r,-o];
  const p=(x,y)=>`${F3(cx+x)} ${F3(cy+y)}`, c1=mixP(top,Q,cT), c2=mixP(P,Q,cA);
  const m=(v,sx,sy)=>[v[0]*sx,v[1]*sy];
  const corner=(sx,sy,rev)=>{ const A=m(top,sx,sy),B=m(P,sx,sy),C1=m(c1,sx,sy),C2=m(c2,sx,sy); return rev?`C${p(...C2)} ${p(...C1)} ${p(...A)}`:`C${p(...C1)} ${p(...C2)} ${p(...B)}`; };
  return `M${p(...top)} ${corner(1,1,false)} A${F3(R)} ${F3(R)} 0 0 0 ${p(P[0],-P[1])} ${corner(1,-1,true)} L${p(a-r,o)} ${corner(-1,-1,false)} A${F3(R)} ${F3(R)} 0 0 0 ${p(-P[0],P[1])} ${corner(-1,1,true)} Z`; }
// connector geometry, drawn from the parent's out point (box edge + stroke fold + stub) to the child's near edge.
// fork-rounded: stub, shared spine, smoothed elbow; arc: stub then a quarter ellipse; fork: square elbow.
function ends(n,c){ const sg=c.side===-1?-1:1, ex=c.x-sg*c.w/2, ey=c.y+(c.inY||0);
  if(c.evx!=null) return {sg,sx:c.evx,sy:n.y,spine:c.evx,ex,ey}; // 'evenly' fan: starts inside the parent box, no stub
  const sx=n.x+sg*n.w/2, sy=n.y+(n.outY||0), spine=sx+sg*(n.fold+stubOf(n.st)); return {sg,sx,sy,spine,ex,ey}; }
// 'evenly' out points: per side, the children fan out from points spread across the parent's half width. Siblings are
// split into those above and below the parent centre; nearer ones start further out, on a log2 curve of their rank.
function evenlyStarts(n,ps,w0){ const h=n.w/2-w0/2;
  [1,-1].forEach(sg=>{ const k=kids(n).filter(c=>(c.side===-1?-1:1)===sg); if(!k.length) return;
    const up=k.filter(c=>c.y-n.y<0).map(c=>({c,t:Math.abs(c.y-n.y)})).sort((a,b)=>a.t-b.t), dn=k.filter(c=>c.y-n.y>=0).map(c=>({c,t:Math.abs(c.y-n.y)})).sort((a,b)=>a.t-b.t);
    const l=(up[0]?up[0].t:0)+1e-6, r=(dn[0]?dn[0].t:0)+1e-6, u=(l-r)/(l+r)/2, hu=up.length+u+1.5, hd=dn.length-u+1.5;
    const put=(L,H)=>L.forEach((o,m)=>{ const rate=(L.length-1-m+.5)/H; o.c.evx=n.x+sg*h*Math.log2(rate+1); });
    put(up,hu); put(dn,hd); }); }
export function forkPath(n,c){ const {sg,sx,sy,spine,ex,ey}=ends(n,c), dy=ey-sy;
  if(Math.abs(dy)<1e-6) return `M${F3(sx)} ${F3(sy)} L${F3(spine)} ${F3(sy)} L${F3(spine)} ${F3(sy)} L${F3(ex)} ${F3(ey)}`;
  const Lv=Math.abs(dy), Lh=Math.abs(ex-spine), sgy=Math.sign(dy), r=Math.max(0,Math.min(17,Lv/2,Lh));
  const P0=[spine,ey-sgy*r], Q=[spine,ey], P3=[spine+sg*r,ey], c1=mixP(P0,Q,ctl(Lv-r,r)), c2=mixP(P3,Q,ctl(Lh-r,r));
  return `M${F3(sx)} ${F3(sy)} L${F3(spine)} ${F3(sy)} L${F3(P0[0])} ${F3(P0[1])} C${F3(c1[0])} ${F3(c1[1])} ${F3(c2[0])} ${F3(c2[1])} ${F3(P3[0])} ${F3(P3[1])} L${F3(ex)} ${F3(ey)}`; }
export function arcPath(n,c){ const {sg,sx,sy,spine,ex,ey}=ends(n,c), dx=ex-spine, dy=ey-sy;
  if(Math.abs(dy)<1e-6||Math.abs(dx)<1e-6) return `M${F3(sx)} ${F3(sy)} L${F3(spine)} ${F3(sy)} L${F3(ex)} ${F3(ey)}`;
  const sweep=(dy<0)===(sg>0)?1:0;
  return `M${F3(sx)} ${F3(sy)} L${F3(spine)} ${F3(sy)} A${F3(Math.abs(dx))} ${F3(Math.abs(dy))} 0 0 ${sweep} ${F3(ex)} ${F3(ey)}`; }
function elbowPath(n,c){ const {sx,sy,spine,ex,ey}=ends(n,c); return `M${F3(sx)} ${F3(sy)} L${F3(spine)} ${F3(sy)} L${F3(spine)} ${F3(ey)} L${F3(ex)} ${F3(ey)}`; }
// centre line as points (for the tapered root branches): stub, then the elbow or quarter ellipse, every ~2px
function centreLine(n,c,kind){ const {sg,sx,sy,spine,ex,ey}=ends(n,c), dx=ex-spine, dy=ey-sy, pts=[[sx,sy]];
  const seg=(a,b)=>{ const L=Math.hypot(b[0]-a[0],b[1]-a[1]), k=Math.max(1,Math.ceil(L/2)); for(let i=1;i<=k;i++) pts.push([a[0]+(b[0]-a[0])*i/k,a[1]+(b[1]-a[1])*i/k]); };
  seg([sx,sy],[spine,sy]); const corner=pts.length-1;
  if(Math.abs(dy)<1e-6) seg([spine,sy],[ex,ey]);
  else if(kind==='arc'){ const rx=Math.abs(dx), ry=Math.abs(dy), N=Math.max(8,Math.ceil((rx+ry)*0.8)); // centre of the ellipse sits at (spine+dx, sy)
    for(let i=1;i<=N;i++){ const t=i/N*Math.PI/2; pts.push([spine+dx*(1-Math.cos(t)), sy+dy*Math.sin(t)]); } }
  else { seg([spine,sy],[spine,ey]); seg([spine,ey],[ex,ey]); }
  return {pts,corner}; }
function taperedPath(n,c,kind,w0,w1,shared){ const {pts,corner}=centreLine(n,c,kind); const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const L=cum[cum.length-1]||1, keep=shared?cum[corner]+w0/2:0;
  const wAt=s=>s<=keep?w0:(()=>{ const t=Math.min(1,(s-keep)/Math.max(1e-6,L-keep)); return w0*(1-t)+w1*t; })();
  const left=[], right=[];
  for(let i=0;i<pts.length;i++){ const p=pts[i], a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)];
    let d1=i>0?[p[0]-a[0],p[1]-a[1]]:[b[0]-p[0],b[1]-p[1]], d2=i<pts.length-1?[b[0]-p[0],b[1]-p[1]]:d1; const nz=v=>{ const l=Math.hypot(v[0],v[1])||1; return [v[0]/l,v[1]/l]; }; d1=nz(d1); d2=nz(d2);
    const n1=[-d1[1],d1[0]], n2=[-d2[1],d2[0]]; let m=[n1[0]+n2[0],n1[1]+n2[1]]; const dot=1+n1[0]*n2[0]+n1[1]*n2[1]; m=dot>1e-3?[m[0]/dot,m[1]/dot]:n2;
    const hw=wAt(cum[i])/2; left.push([p[0]+m[0]*hw,p[1]+m[1]*hw]); right.push([p[0]-m[0]*hw,p[1]-m[1]*hw]); }
  const P=[...left,...right.reverse()]; return 'M'+P.map(q=>`${F3(q[0])} ${F3(q[1])}`).join(' L')+' Z'; }
// ---------- stickers: own vector drawings for the six classic markers (24×24, white sticker outline) ----------
const O='stroke="#FAFAFA" stroke-width="2.2" stroke-linejoin="round" paint-order="stroke"';
export const STICKERS={
 '💡':`<g transform="translate(12 12) scale(.74) translate(-12 -12)"><g ${O}><path d="M12 4.2a6 6 0 0 0-3.4 10.9v2.1h6.8v-2.1A6 6 0 0 0 12 4.2z" fill="#EF9B3A"/><rect x="8.9" y="18.4" width="6.2" height="2.6" rx="1" fill="#EF9B3A"/></g><path d="M9.6 10.2l1.2 2 1.2-1.6 1.2 1.6 1.2-2" fill="none" stroke="#FAFAFA" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><g stroke="#EF9B3A" stroke-width="1.5" stroke-linecap="round"><path d="M12 .9v1.4M5.6 3.4l1 1M18.4 3.4l-1 1M3 9h1.4M19.6 9H21"/></g></g>`,
 '⚡':`<path ${O} d="M9.6 2.8h7.6l-3.2 6.2h4.4L7.8 21.6l2.9-8.4H6.4z" fill="#EFB840" stroke-linejoin="round"/>`,
 '✏️':`<path ${O} d="M16.4 2.6l3.4 3.4L9 16.8l-4.6 1.2 1.2-4.6z" fill="#00C9FF"/><path d="M15 4l3.4 3.4" stroke="#FAFAFA" stroke-width="1.2"/><rect ${O} x="4" y="20" width="16" height="2" rx="1" fill="#44D7FF"/>`,
 '⭐':`<path d="M12 3.6l2.3 4.6 5.1.7-3.7 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.7-3.6 5.1-.7z" fill="#FFBA00" stroke="#FAFAFA" stroke-width="5.4" stroke-linejoin="round"/><path d="M12 3.6l2.3 4.6 5.1.7-3.7 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.7-3.6 5.1-.7z" fill="#FFBA00" stroke="#FFBA00" stroke-width="2.6" stroke-linejoin="round"/><path d="M16.4 12.5l.9 5.1-4.6-2.4 2.2 3.4 4.4 1.2-1-5.4 3.6-3.4z" fill="#FFDD3C" stroke="#FFDD3C" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 8.6l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="#FDFDFD" stroke="#FDFDFD" stroke-width=".6" stroke-linejoin="round"/>`,
 '👍':`<path ${O} d="M3.4 10.4h3.4v10H3.4zM8.4 10.2l3.6-6.6c1.6-.6 2.8.4 2.6 2l-.6 3.4h5.2c1.3 0 2.2 1.2 1.9 2.4l-1.8 7.2c-.3 1.1-1.2 1.8-2.3 1.8H8.4z" fill="#EFB840"/>`,
 '❌':`<g transform="translate(12 12) scale(.9) translate(-12 -12)"><path d="M5 5l14 14M19 5L5 19" stroke="#FAFAFA" stroke-width="6" stroke-linecap="round"/><path d="M5 5l14 14M19 5L5 19" stroke="#DE4825" stroke-width="3.2" stroke-linecap="round"/></g>`
};
export const stickerOf=ic=>STICKERS[ic]||STICKERS[String(ic||'').replace(/\uFE0F/g,'')]||STICKERS[String(ic||'')+'\uFE0F']||null;

// ---------- rendering ----------
const XC=c=>esc(String(c));
function textSvg(n,s,left,top,fill){ const F=n.font, M=metrics(F), lh=n.lhC, base=Math.floor((lh-(M.a+M.d))/2)+M.a, al=s.align||'left';
  const W=n.txw, lx=l=>al==='center'?left+W/2-u64(tw(l,F))/2:al==='right'?left+W-u64(tw(l,F)):left;
  const deco=[s.ul?'underline':'',s.lt?'line-through':''].filter(Boolean).join(' ');
  return `<text font-size="${s.fs}" font-weight="${s.fw==='bold'||+s.fw>=600?'bold':'normal'}"${s.fi?' font-style="italic"':''} fill="${XC(fill)}"${deco?` text-decoration="${deco}"`:''} style="font-family:${famOf(s).replace(/"/g,'&quot;')};white-space:pre;text-spacing-trim:space-all">${n.lines.map((l,i)=>`<tspan x="${F3(lx(l))}" y="${F3(top+i*lh+base)}">${esc(l)}</tspan>`).join('')}</text>`; }
function shapePath(n,s){ if(n.arc) return arcSides(n.x,n.y,n.w,n.h,+s.r||0); const r=Math.max(0,+s.r||0); return r?smoothRect(n.x,n.y,n.w,n.h,r):`M${F3(n.x-n.w/2)} ${F3(n.y-n.h/2)} h${F3(n.w)} v${F3(n.h)} h${F3(-n.w)} Z`; }
const LINK_P='<path stroke-width="1" stroke="currentColor" fill="none" stroke-linecap="round" d="M2.8,0.3l2.5-2.5c0.8-0.9,0.8-2.3,0-3.1C4.5-6.2,3.1-6.2,2.2-5.4l-2.9,2.9c-0.8,0.9-0.8,2.3,0.1,3.1"/><path stroke-width="1" stroke="currentColor" fill="none" stroke-linecap="round" d="M0.7-0.7c0.9,0.9,0.8,2.3,0,3.2l-2.9,2.9c-0.9,0.8-2.3,0.8-3.1,0c-0.9-0.9-0.9-2.3,0-3.1l2.5-2.5"/>';
export function clNodeSvg(n,th,root){ const S=(root&&root.spec)||DEFSPEC, s=n.st||S.lv[Math.min(n.d,2)], d=n.d, x=n.x-n.w/2, y=n.y-n.h/2; let g='';
  const legacy=S===DEFSPEC; // the built-in peach look keeps its theme colours
  const fill=legacy?(d===0?th.root:d===1?'#FFFFFF':'transparent'):s.fill, stroke=legacy?(d===1?th.l1Stroke:'none'):s.stroke, sw=+s.sw||0;
  const vis=!isNone(fill)||(!isNone(stroke)&&sw>0);
  g+=`<rect class="hit" x="${F3(x)}" y="${F3(y)}" width="${F3(n.w)}" height="${F3(n.h)}" fill="transparent" stroke="none"/>`;
  if(s.shape==='underline'){ if(!isNone(stroke)&&sw>0) g+=`<path data-g="node" d="M${F3(x)} ${F3(y+n.h)} L${F3(x+n.w)} ${F3(y+n.h)}" stroke="${XC(stroke)}" stroke-width="${sw}" fill="none"/>`; }
  else if(vis) g+=`<path data-g="node" d="${shapePath(n,s)}" fill="${isNone(fill)?'transparent':XC(fill)}" stroke="${!isNone(stroke)&&sw>0?XC(stroke):'none'}"${sw>0&&!isNone(stroke)?` stroke-width="${sw}"`:''}${s.dash&&sw>0?` stroke-dasharray="${XC(s.dash)}"`:''}/>`;
  else if(n.arc) g+=`<path d="${shapePath(n,s)}" fill="transparent" stroke="none"/>`;
  const med=n.media; let rowY=n.y;
  if(med){ const top=n.y-n.ch/2; g+=`<image data-g="${med.kind}" href="${XC(med.src)}" x="${F3(n.x-med.w/2)}" y="${F3(top)}" width="${med.w}" height="${med.h}" preserveAspectRatio="none"/>`; rowY=top+med.h+n.mgap+n.rowH/2; }
  const rowW=n.rowW, left=med?n.x-rowW/2:n.arc?n.x-n.cw/2:x+n.padX; let cx=left;
  if(n.pri){ const B=priB(s.fs), bx=cx; g+=`<g data-g="badge"><circle cx="${F3(bx+B/2)}" cy="${F3(rowY)}" r="${F3((B-1)/2)}" fill="${PRI_C[(n.pri-1)%PRI_C.length]}" stroke="#FFFFFF" stroke-width="${F3(B/18)}"/><text x="${F3(bx+B/2)}" y="${F3(rowY+4)}" text-anchor="middle" fill="#FFFFFF" style="font-weight:bold;font-family:Arial;font-size:${F3(B*.625)}px">${n.pri}</text></g>`; cx+=B+BGAP; }
  const icons=Array.isArray(n.gi)?n.gi:[];
  if(n.icon&&!icons.length){ const st=stickerOf(n.icon), ix=cx, iy=rowY-21/2;
    g+=st?`<g data-g="icon" transform="translate(${F3(ix)} ${F3(iy)}) scale(${21/24})" aria-hidden="true">${st}</g>`:`<text x="${F3(ix)}" y="${F3(rowY+s.fs*.36)}" font-size="${s.fs}" aria-hidden="true">${esc(n.icon)}</text>`; cx+=21+ICON_GAP; }
  icons.forEach(k=>{ const src=S.assets[k]; const B=n.ic; if(src) g+=`<image data-g="icon" href="${XC(src)}" x="${F3(cx+2)}" y="${F3(rowY-B/2+2)}" width="${B-4}" height="${B-4}"/>`; cx+=B+ICON_GAP; });
  const tc=legacy?(d===0?th.rootText:th.text):s.color;
  g+=textSvg(n,s,cx,rowY-n.txh/2,tc);
  if(n.link&&!legacy){ const lx=cx+n.txw+LINK_GAP, ly=rowY-LINK_W/2; g+=`<a class="linkic" href="${XC(n.link)}" target="_blank" rel="noopener noreferrer" aria-label="開啟連結：${XC(n.link)}"><rect x="${F3(lx)}" y="${F3(ly)}" width="${LINK_W}" height="${LINK_W}" fill="transparent"/><g transform="translate(${F3(lx+10)} ${F3(ly+10)})" style="color:${XC(s.color)}">${LINK_P}</g></a>`; }
  return {g,rx:n.arc?n.h/2:Math.max(+s.r||0,4),x,y}; }
// collapsed-branch marker: a short line from the out point (box edge, or the underline's end) to a circle filled with
// the canvas colour, showing the hidden count (three dots above 99)
export function clExpander(n,count,bg='#FFFFFF'){ const s=n.st||{}, sg=n.side===-1?-1:1, ex=n.x+sg*(n.w/2+n.fold+13), y=n.y+(n.outY||0), c=isNone(s.stroke)?(s.cc||'#999'):s.stroke, lw=isNone(s.stroke)?1:Math.max(1,+s.sw||1);
  const t=count>99?`<path fill="${XC(c)}" d="M${F3(ex+1.25)} ${F3(y)} a1.25 1.25 0 1 1 -2.5 0 a1.25 1.25 0 1 1 2.5 0 z M${F3(ex-2.5)} ${F3(y)} a1.25 1.25 0 1 1 -2.5 0 a1.25 1.25 0 1 1 2.5 0 z M${F3(ex+5)} ${F3(y)} a1.25 1.25 0 1 1 -2.5 0 a1.25 1.25 0 1 1 2.5 0 z"/>`
    :`<text x="${F3(ex)}" y="${F3(y+(count>9?3.168:3.96))}" text-anchor="middle" fill="${XC(c)}" style="font-family:Arial;font-size:${count>9?8.8:11}px">${count}</text>`;
  return `<path d="M${F3(ex-sg*(13+n.fold))} ${F3(y)} L${F3(ex)} ${F3(y)}" stroke="${XC(c)}" stroke-width="${lw}"/><path d="M${F3(ex+7.5)} ${F3(y)} A7.5 7.5 0 1 1 ${F3(ex-7.5)} ${F3(y)} A7.5 7.5 0 1 1 ${F3(ex+7.5)} ${F3(y)}" stroke="${XC(c)}" stroke-width="1" fill="${XC(bg)}"/>${t}`; }
export function clEdges(nodes,th,root){ const S=(root&&root.spec)||DEFSPEC, legacy=S===DEFSPEC; let e='';
  nodes.forEach(n=>{ const k=kids(n), ps0=n.st||S.lv[Math.min(n.d,2)];
    k.forEach(c=>{ c.evx=null; }); if(!legacy&&ps0.adj==='evenly'&&(ps0.conn||'')==='arc'&&k.length) evenlyStarts(n,ps0,ps0.tap&&n.d===0?(+ps0.tapW||10):(+ps0.cw||2));
    k.forEach(c=>{ const ps=ps0, cs=c.st||S.lv[Math.min(c.d,2)];
    const col=legacy?th.line:(cs.ec||cs.cc), w=legacy?2:(+cs.ecw||+cs.cw||2), kind=ps.conn||'fork-rounded';
    if(!legacy&&ps.tap&&n.d===0){ e+=`<path data-g="edge" d="${taperedPath(n,c,kind==='arc'?'arc':'fork',+ps.tapW||10,w,k.length>1)}" fill="${XC(col)}" stroke="none"/>`; return; }
    const d=kind==='arc'?arcPath(n,c):kind==='fork'?elbowPath(n,c):forkPath(n,c);
    e+=`<path data-g="edge" d="${d}" fill="none" stroke="${XC(col)}" stroke-width="${w}"${cs.edash?` stroke-dasharray="${XC(cs.edash)}"`:''}/>`; }); }); return e; }
