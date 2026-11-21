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
const tw=(s,font)=>{ askFonts(); const k=font+'|'+s; let v=twc.get(k); if(v===undefined){ mctx.font=font; v=mctx.measureText(s).width; twc.set(k,v); if(twc.size>20000) twc.clear(); } return v; };
const metc=new Map();
function metrics(font){ let m=metc.get(font); if(!m){ mctx.font=font; const t=mctx.measureText('中Hg'); m={a:Math.round(t.fontBoundingBoxAscent||0), d:Math.round(t.fontBoundingBoxDescent||0)}; metc.set(font,m); } return m; }
const u64=v=>Math.ceil(v*64-1e-6)/64, f64=v=>Math.floor(v*64+1e-6)/64;
// level styles: font size, weight, padding [y,x], margin, out-stub minimum, gap to children
const LV=[{fs:26,fw:700,py:16,px:24,m:50,hg:51,out:16.65},{fs:16,fw:700,py:10,px:15,m:30,hg:31,out:14},{fs:14,fw:400,py:6,px:9,m:20,hg:26,out:13}];
export const lvOf=d=>LV[Math.min(d,2)];
export const fontOfC=d=>{ const L=lvOf(d); return `${L.fw} ${L.fs}px ${CFF}`; };
export const PRI_C=['#e64248','#f9b62a','#5565fb','#bb3aac','#2bcc5b','#25b7e6','#80acb4','#83989b','#8e9698'];
const kids=n=>(n.collapsed||!n.c)?[]:n.c;
const MIN=17, ICON=21, IGAP=6, BADGE=17, BGAP=5, FIX=12;
function size(n,d,br,par){
  n.d=d; n.br=br; n.parent=par||null; n.side=d===0?0:1;
  const L=lvOf(d), F=fontOfC(d), t=n.t==null?'':String(n.t);
  n.lines=t.split('\n').map(l=>l.replace(/[ \t\u00A0]+/g,' ').trim()); n.fs=L.fs; // shown like HTML text: runs of spaces collapse, line ends trim
  n.lhC=f64(L.fs*1.2);
  const txw=u64(Math.max(0,...n.lines.map(l=>tw(l,F)))), txh=n.lines.length*n.lhC;
  let cw=txw, ch=txh; n.txw=txw; n.txh=txh;
  if(n.icon){ cw+=ICON+IGAP; ch=Math.max(ch,ICON); }
  if(n.pri){ cw+=BADGE+BGAP; ch=Math.max(ch,BADGE); }
  cw=Math.max(cw,MIN); ch=Math.max(ch,MIN);
  const W0=cw+2*L.px, H=ch+2*L.py; n.arc=d===0||n.shape==='arc';
  n.w=n.arc?W0-L.py/2+H/2:W0; n.h=H; n.padX=L.px; n.cw=cw;
  (n.c||[]).forEach((c,i)=>size(c,d+1,d===0?i:br,n));
}
function anchor(ys){ const t=(ys[0]+ys[ys.length-1])/2; if(ys.length<=2) return t;
  let i=Infinity,o=null; for(let c=1;c<ys.length-1;c++){ const n=Math.abs(ys[c]-t); if(!(n<i)) break; i=n; o=ys[c]; }
  let a=Infinity,s=null; for(let c=0;c<ys.length-1;c++){ const m=(ys[c]+ys[c+1])/2, dd=Math.abs(m-t); if(!(dd<a)) break; a=dd; s=m; }
  const l=Math.min(i,a); return l<FIX?(i===l?o:s):t; }
const offOf=n=>n.off&&typeof n.off==='object'?{x:Math.max(0,+n.off.x||0),y:+n.off.y||0}:{x:0,y:0};
function stack(n){ const k=kids(n); n.mv=lvOf(n.d).m+(k.length?4:0);
  if(!k.length){ n.top=-n.h/2; n.bot=n.h/2; return; }
  k.forEach(stack); let y=0, prev=null; const ys=[];
  k.forEach(c=>{ if(prev) y+=Math.max(prev.mv,c.mv); c.ry=y-c.top; ys.push(c.ry); y=c.ry+c.bot; prev=c; });
  const an=anchor(ys); let top=-n.h/2, bot=n.h/2;
  k.forEach(c=>{ c.ry+=offOf(c).y-an; top=Math.min(top,c.ry+c.top); bot=Math.max(bot,c.ry+c.bot); });
  n.top=top; n.bot=bot; }
function place(n,x,y){ n.x=x; n.y=y; kids(n).forEach(c=>place(c,x+n.w/2+lvOf(n.d).hg+c.w/2+offOf(c).x,y+c.ry)); }
export function clLayout(root){ size(root,0,0,null); stack(root); place(root,0,0); root.layout='right'; root.cl=true; root.boxed=false; return root; }

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
// fork-rounded connector: stub out, shared vertical spine, smoothed elbow into the child's left edge
export function forkPath(n,c){ const sx=n.x+n.w/2, sy=n.y, spine=sx+lvOf(n.d).out, ex=c.x-c.w/2, ey=c.y, dy=ey-sy;
  if(Math.abs(dy)<1e-6) return `M${F3(sx)} ${F3(sy)} L${F3(spine)} ${F3(sy)} L${F3(spine)} ${F3(sy)} L${F3(ex)} ${F3(ey)}`;
  const Lv=Math.abs(dy), Lh=ex-spine, sg=Math.sign(dy), r=Math.max(0,Math.min(17,Lv/2,Lh));
  const P0=[spine,ey-sg*r], Q=[spine,ey], P3=[spine+r,ey], c1=mixP(P0,Q,ctl(Lv-r,r)), c2=mixP(P3,Q,ctl(Lh-r,r));
  return `M${F3(sx)} ${F3(sy)} L${F3(spine)} ${F3(sy)} L${F3(P0[0])} ${F3(P0[1])} C${F3(c1[0])} ${F3(c1[1])} ${F3(c2[0])} ${F3(c2[1])} ${F3(P3[0])} ${F3(P3[1])} L${F3(ex)} ${F3(ey)}`; }

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
export function clNodeSvg(n,th){ const d=n.d, L=lvOf(d), x=n.x-n.w/2, y=n.y-n.h/2; let g='';
  if(d===0) g+=`<path data-g="node" d="${arcSides(n.x,n.y,n.w,n.h,8)}" fill="${th.root}" stroke="none"/>`;
  else if(d===1) g+=`<path data-g="node" d="${smoothRect(n.x,n.y,n.w,n.h,10)}" fill="#FFFFFF" stroke="${th.l1Stroke}" stroke-width="2"/>`;
  else if(n.arc) g+=`<path d="${arcSides(n.x,n.y,n.w,n.h,5)}" fill="transparent" stroke="none"/>`;
  g=`<rect class="hit" x="${F3(x)}" y="${F3(y)}" width="${F3(n.w)}" height="${F3(n.h)}" fill="transparent" stroke="none"/>`+g;
  const left=n.arc?n.x-n.cw/2:x+L.px; let cx=left;
  if(n.pri){ const bx=cx, by=n.y-8.5; g+=`<g data-g="badge"><circle cx="${F3(bx+8.5)}" cy="${F3(n.y)}" r="8" fill="${PRI_C[(n.pri-1)%PRI_C.length]}" stroke="#FFFFFF" stroke-width=".944"/><text x="${F3(bx+8.5)}" y="${F3(by+12.5)}" text-anchor="middle" fill="#FFFFFF" style="font-weight:bold;font-family:Arial;font-size:10.625px">${n.pri}</text></g>`; cx+=BADGE+BGAP; }
  if(n.icon){ const st=stickerOf(n.icon), ix=cx, iy=n.y-ICON/2;
    g+=st?`<g data-g="icon" transform="translate(${F3(ix)} ${F3(iy)}) scale(${ICON/24})" aria-hidden="true">${st}</g>`:`<text x="${F3(ix)}" y="${F3(n.y+L.fs*.36)}" font-size="${L.fs}" aria-hidden="true">${esc(n.icon)}</text>`; cx+=ICON+IGAP; }
  const F=fontOfC(d), M=metrics(F), lh=n.lhC, top=n.y-n.txh/2, base=Math.floor((lh-(M.a+M.d))/2)+M.a, fill=d===0?th.rootText:th.text;
  const anchorMid=d===0, tx=anchorMid?n.x:cx;
  const lx=l=>anchorMid?n.x-u64(tw(l,F))/2:tx; // centred lines start at a LayoutUnit-rounded left edge, as HTML does
  g+=`<text font-size="${L.fs}" font-weight="${L.fw===700?'bold':'normal'}" fill="${fill}" style="font-family:${CFF.replace(/"/g,'&quot;')}">${n.lines.map((l,i)=>`<tspan x="${F3(lx(l))}" y="${F3(top+i*lh+base)}">${esc(l)}</tspan>`).join('')}</text>`;
  return {g,rx:d===1?10:d===0?n.h/2:5,x,y}; }
export function clEdges(nodes,th){ let e=''; nodes.forEach(n=>kids(n).forEach(c=>{ e+=`<path data-g="edge" d="${forkPath(n,c)}" fill="none" stroke="${th.line}" stroke-width="2"/>`; })); return e; }
