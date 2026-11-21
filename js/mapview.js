// Layout + SVG rendering for the right-expanding logic chart (DESIGN §7). Pure functions: data in, SVG string out.
import { readable, cr, lum, mix, tint, esc, PRI, P } from './core.js';
const mctx=document.createElement('canvas').getContext('2d');
export const FF='"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';
const twc=new Map();
export const tw=(s,font)=>{const k=font+'|'+s; let v=twc.get(k); if(v===undefined){mctx.font=font;v=mctx.measureText(s).width;twc.set(k,v); if(twc.size>20000)twc.clear();} return v;};
export const fsOf=d=>d===0?22:d===1?16:14;
export const fontOf=(d,th)=>d===0?`700 22px ${FF}`:d===1?`${th&&th.l1==='box'?700:600} 16px ${FF}`:`400 14px ${FF}`;
export const kids=n=>(n.collapsed||!n.c)?[]:n.c;
export const all=(n,a=[])=>{a.push(n);kids(n).forEach(c=>all(c,a));return a;};
export const allDeep=(n,a=[])=>{a.push(n);(n.c||[]).forEach(c=>allDeep(c,a));return a;};
export const countDesc=n=>(n.c||[]).reduce((s,c)=>s+1+countDesc(c),0);
const SPACING={compact:[48,6],standard:[64,10],loose:[84,16]};

export const tagsOf=n=>Array.isArray(n.tags)?n.tags:(n.tag?[n.tag]:[]);
export const IMG_MAX=[200,140];
export function imgBox(img){ if(!img||!img.src) return null; const w=img.w||160,h=img.h||120,k=Math.min(1,IMG_MAX[0]/w,IMG_MAX[1]/h); return {w:Math.round(w*k),h:Math.round(h*k)}; }
const TAGF=`600 11.5px ${FF}`;
export function tagChips(n){ const t=tagsOf(n); const shown=t.slice(0,3).map(x=>'#'+x); if(t.length>3) shown.push('+'+(t.length-3)); return shown; }
function prep(n,d,br,boxed,th,par){
  if(d>0&&Number.isInteger(n.color)) br={m:n.color};
  n.d=d; n.br=br; n.parent=par||null;
  const fs=fsOf(d), padX=d===0?28:d===1?18:(boxed?12:8), F=fontOf(d,th), t=n.t||' ';
  const MAXT=d===0?300:d===1?200:160, full=tw(t,F);
  if(t.includes('\n')) n.lines=t.split('\n').slice(0,2);
  else if(full>MAXT){const ch=[...t]; let k=0; const goal=Math.min(MAXT,full/2);
    for(;k<ch.length;k++){if(tw(ch.slice(0,k+1).join(''),F)>=goal)break;}
    for(let q=Math.max(1,k-3);q<=Math.min(ch.length-2,k+3);q++) if('，、。：；）」,'.includes(ch[q])){k=q;break;}
    let a=ch.slice(0,k+1).join(''), b=ch.slice(k+1).join(''); const sp=a.lastIndexOf(' '); if(sp>a.length*.6&&/^[\x00-\x7F]/.test(b)){b=a.slice(sp+1)+b;a=a.slice(0,sp);}
    while(tw(b,F)>MAXT&&b.length>2) b=b.slice(0,-2)+'…';
    n.lines=[a.trim(),b.trim()];} else n.lines=null;
  let w=n.lines?Math.max(...n.lines.map(l=>tw(l,F))):full;
  n.lh=n.lines?Math.round(fs*1.45):0;
  if(n.icon) w+=fs*1.15+6; if(n.pri) w+=24; if(n.done) w+=24;
  tagChips(n).forEach(c=>{ w+=tw(c,TAGF)+16+6; }); if(tagChips(n).length) w+=2; if(n.note) w+=22; if(n.link) w+=22;
  const ib=imgBox(n.img); n.ib=ib; n.ih=ib?ib.h+10:0;
  n.w=Math.ceil(Math.max(w,ib?ib.w:0)+padX*2); n.h=(d===0?58:d===1?42:(boxed?34:32))+n.lh+n.ih; n.padX=padX;
  (n.c||[]).forEach((c,i)=>prep(c,d+1,d===0?i:br,boxed,th,n));
}
function subH(n,g1){const k=kids(n); if(!k.length) return n.h; const g=n.d===0?26:g1; return Math.max(n.h,k.reduce((s,c)=>s+subH(c,g1),0)+g*(k.length-1));}
function placeH(n,cx,top,hg1,g1){
  const sh=subH(n,g1); n.x=cx; n.y=top+sh/2; n.side=1;
  const k=kids(n); if(!k.length) return;
  const g=n.d===0?26:g1, tot=k.reduce((s,c)=>s+subH(c,g1),0)+g*(k.length-1);
  let y=n.y-tot/2; const hg=n.d===0?hg1:Math.round(hg1*.62);
  k.forEach(c=>{placeH(c,n.x+n.w/2+hg+c.w/2,y,hg1,g1); y+=subH(c,g1)+g;});
}
function mirror(n){ n.x=-n.x; n.side=-1; kids(n).forEach(mirror); }
function placeBalanced(root,hg,g){ root.x=0; root.y=0; root.side=0; const k=kids(root); if(!k.length) return;
  const hs=k.map(c=>subH(c,g)), total=hs.reduce((a,b)=>a+b,0); let acc=0, cut=k.length;
  for(let i=0;i<k.length;i++){ if(acc>=total/2&&i>0){ cut=i; break; } acc+=hs[i]; } if(cut===k.length&&k.length>1) cut=Math.ceil(k.length/2);
  const R=k.slice(0,cut), L=k.slice(cut); const G=26;
  for(const [grp,sgn] of [[R,1],[L,-1]]){ if(!grp.length) continue; const tot=grp.reduce((s,c)=>s+subH(c,g),0)+G*(grp.length-1); let y=-tot/2;
    grp.forEach(c=>{ placeH(c,root.w/2+hg+c.w/2,y,hg,g); if(sgn<0) mirror(c); y+=subH(c,g)+G; }); }
  root.sides={R:R.map(c=>c.id),L:L.map(c=>c.id)}; }
const ORG={vg:58,hg:28,ind:24,rg:10};
function orgColW(n,ind){ let w=n.w+ind; kids(n).forEach(c=>{ w=Math.max(w,orgColW(c,ind+ORG.ind)); }); return w; }
function orgCol(n,left,ind,yRef){ kids(n).forEach(c=>{ c.x=left+ind+c.w/2; c.y=yRef.y+c.h/2; c.side=2; yRef.y+=c.h+ORG.rg; orgCol(c,left,ind+ORG.ind,yRef); }); }
function placeOrg(root){ root.x=0; root.y=0; root.side=0; const k=kids(root); if(!k.length) return;
  const ws=k.map(c=>orgColW(c,0)), total=ws.reduce((a,b)=>a+b,0)+ORG.hg*(k.length-1); let x=-total/2; const top=root.h/2+ORG.vg;
  const hmax=Math.max(...k.map(c=>c.h));
  k.forEach((c,i)=>{ c.x=x+c.w/2; c.y=top+hmax/2; c.side=3; const yRef={y:top+hmax+ORG.rg+4}; orgCol(c,x,ORG.ind,yRef); x+=ws[i]+ORG.hg; }); }
export const LAYOUTS=[['right','向右邏輯圖'],['balanced','左右心智圖'],['org','組織圖']];
export function layout(root,th,st={}){
  const boxed=!!th.deepBox; const [hg,g]=SPACING[st.spacing||'standard']||SPACING.standard; const mode=['balanced','org'].includes(st.layout)?st.layout:'right';
  prep(root,0,0,boxed,th,null); root.boxed=boxed; root.layout=mode;
  if(mode==='balanced') placeBalanced(root,hg,g);
  else if(mode==='org') placeOrg(root);
  else { placeH(root,0,-subH(root,g)/2,hg,g); if((st.rootTop??th.rootTop)&&kids(root).length){root.y=kids(root)[0].y;} }
  return root;
}
export function bounds(root){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;all(root).forEach(n=>{const cc=n.collapsed&&n.c&&n.c.length?28:0; x0=Math.min(x0,n.x-n.w/2-(n.side===-1?cc:0));x1=Math.max(x1,n.x+n.w/2+(n.side===-1?0:cc));y0=Math.min(y0,n.y-n.h/2);y1=Math.max(y1,n.y+n.h/2)});return{x0,y0,x1,y1,w:x1-x0,h:y1-y0};}
export function colorOf(n,th){ if(n.d===0) return th.root; if(n.br&&typeof n.br==='object'){ const M=marks(th); return M[n.br.m%M.length][0]; } return th.br[n.br%th.br.length]; }
// Colour marks: the theme's own branch colours when it has enough distinct ones, else a fixed set tuned for light/dark.
// Each has a plain name so the picker never relies on colour alone.
const MARKS_L=[['#D9433A','紅'],['#CC701C','橙'],['#AA8205','黃'],['#2E9E5B','綠'],['#2F7BDB','藍'],['#8A55D6','紫']];
const MARKS_D=[['#FF6B6B','紅'],['#FFA552','橙'],['#F2CC4B','黃'],['#4FD18B','綠'],['#6BA8FF','藍'],['#B794F6','紫']];
export function hueName(hex){ const h=hex.replace('#',''); const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); const mx=Math.max(r,g,b),mn=Math.min(r,g,b),dl=mx-mn; if(dl<.12) return mx>.6?'淺灰':'灰'; let H=mx===r?((g-b)/dl)%6:mx===g?(b-r)/dl+2:(r-g)/dl+4; H=(H*60+360)%360;
  return H<15||H>=340?'紅':H<40?'橙':H<70?'黃':H<165?'綠':H<200?'青':H<255?'藍':H<290?'紫':'粉'; }
export function marks(th){ const u=[...new Set(th.br.map(c=>c.toUpperCase()))]; if(u.length>=5) return u.slice(0,6).map(c=>[c,hueName(c)]); return th.dark?MARKS_D:MARKS_L; }

/* opt: {sel:id, lightLines:bool, sc:number (current zoom, for minimum visual line width), thumb, edge:'bracket'|'curve'|'straight', lw:'thin'|'standard'|'thick', lod, drop:id} */
export function renderMap(root,th,opt={}){
  const nodes=all(root); let edges='',body='',defs='';
  const nodeBg=th.dark?'#1E2128':'#FFFFFF';
  const CV=th.canvas, LIGHT=!!(opt.lightLines&&th.lineLight&&!opt.thumb), G=(c,bg=CV)=>LIGHT?c:readable(c,bg,3);
  const SEL=lum(CV)>.35?'#3F51E8':'#8B9BFF', SELK=lum(CV)>.35?'#FFFFFF':'#0E1020';
  const lineC=LIGHT?th.lineLight:th.line, brC=n=>LIGHT?th.lineLight:G(colorOf(n,th));
  const edge=opt.edge||th.edge||'curve', mult={thin:.75,standard:1,thick:1.5}[opt.lw||'standard']||1;
  // minimum visual line width: never thinner than 1.5 CSS px on screen, whatever the zoom (review r4 dev-suggestion 3)
  const minW=opt.sc?1.5/opt.sc:0;
  const ORGM=root.layout==='org';
  nodes.forEach(n=>[...kids(n)].sort((a,b)=>Math.abs(b.y-n.y)-Math.abs(a.y-n.y)).forEach(c=>{
    const col=colorOf(c,th); let p='';
    const s=c.side===-1?-1:1, plainOff=(m)=>th.deep==='plain'&&m.d>=2?(m.padX-5):0;
    const x1=n.x+s*(n.w/2-plainOff(n)), x2=c.x-s*(c.w/2-plainOff(c));
    if(ORGM){ const r=8; const under=c.d>=2&&!root.boxed&&th.deep!=='plain';
      if(c.side===3){ const yb=n.y+n.h/2, yt=c.y-c.h/2, ym=yb+ORG.vg/2, dx=c.x-n.x, sg=Math.sign(dx), rr=Math.min(r,Math.abs(dx)/2);
        p=Math.abs(dx)<1?`M${n.x},${yb} V${yt}`:`M${n.x},${yb} V${ym-rr} Q${n.x},${ym} ${n.x+sg*rr},${ym} H${c.x-sg*rr} Q${c.x},${ym} ${c.x},${ym+rr} V${yt}`; }
      else { const px=n.x-n.w/2+Math.min(16,n.w/3), yb=n.y+n.h/2-(n.d>=2&&!root.boxed&&th.deep!=='plain'?0:0), y2=under?c.y+c.h/2:c.y, xe=c.x-c.w/2;
        p=`M${px},${yb} V${y2-r} Q${px},${y2} ${px+r},${y2} H${xe}`; if(under) p+=` H${c.x+c.w/2}`; }
    } else if(edge==='bracket'){
      const xm=x1+(x2-x1)*.5, dy=c.y-n.y, r=Math.min(th.er||8,Math.abs(dy)), sg=Math.sign(dy);
      p=Math.abs(dy)<1?`M${x1},${n.y} H${x2}`:`M${x1},${n.y} H${xm} V${c.y-sg*r} Q${xm},${c.y} ${xm+s*r},${c.y} H${x2}`;
    } else if(edge==='straight'){ p=`M${x1},${n.y} L${x2},${c.y}`; }
    else { const under=c.d>=2&&!root.boxed&&th.deep!=='plain'; const y2=under?c.y+c.h/2:c.y, sx=n.d===0? n.x+s*(n.w/2-10):x1, xe=c.x-s*c.w/2, dx=(xe-sx)*.5;
      p=`M${sx},${n.y} C${sx+dx},${n.y} ${xe-dx},${y2} ${xe},${y2}`; if(under) p+=` L${c.x+s*c.w/2},${y2}`; }
    const base=th.lw||(th.line?(n.d===0?1.8:1.2):(edge==='bracket'?(n.d===0?2.6:1.6):(n.d===0?3.2:2)));
    edges+=`<path data-g="edge" data-gbg="${CV}" d="${p}" fill="none" stroke="${lineC&&!(c.br&&typeof c.br==='object')?G(lineC):G(col)}" stroke-width="${Math.max(base*mult,minW).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }));
  const R=relsSvg(root,th,opt,{CV,G,SEL,minW}); defs+=R.defs; edges+=R.lines;
  nodes.forEach(n=>{
    const col0=colorOf(n,th), col=n.d===0?th.root:brC(n), x=n.x-n.w/2, y=n.y-n.h/2, d=n.d; let g='';
    let fill='none',stroke='none',txt=th.text,sw=0,rx=8,fw=d===0?700:d===1?600:400, bgc=CV;
    if(d===0){fill=th.root;txt=th.rootText;rx=th.rootPill?n.h/2:14;bgc=fill;}
    else if(d===1){rx=10;
      if(th.l1==='tint'){fill=tint(col0,.12,CV);stroke=col;sw=1.5;}
      else if(th.l1==='solid'){fill=col0;}
      else if(th.l1==='tag'){fill=col0;rx=5;txt='#3B2A20';}
      else if(th.l1==='box'){fill='#FFFFFF';stroke=col;sw=1.5;rx=9;fw=700;}
      else if(th.l1==='pill'){rx=n.h/2; if(lum(col0)<.3){fill=col0;for(let t=0;cr('#FFFFFF',fill)<4.6&&t<=1;t+=.04)fill=mix(col0,'#000000',t);txt='#FFFFFF';} else {fill=col0;txt='#1F2329';}}
      else if(th.l1==='tintDark'){fill=tint(col0,.18,CV);stroke=mix(CV,col0,.7);sw=1.5;}
      else {fill=nodeBg;stroke=col;sw=2;}
      bgc=fill;
    } else if(th.deep==='plain'){fill='none';bgc=CV;} else if(root.boxed&&th.deepBox){fill=tint(col0,.07,'#FFFFFF');stroke=mix('#FFFFFF',col,.75);sw=1.1;rx=7;bgc=fill;} else if(root.boxed){fill=nodeBg;stroke=th.dark?'#353A45':mix('#FFFFFF',col,.45);sw=1.2;bgc=fill;}
    if(!(d>=2&&th.deep==='plain')&&!(fill==='none'&&stroke==='none')){ // every visible node shape gets a >=3:1 edge (WCAG 1.4.11)
      const fb=fill==='none'?1:cr(fill,CV), sb=(stroke==='none'||!sw)?1:cr(stroke,CV);
      if(Math.max(fb,sb)<3){stroke=d===0?(lineC?G(lineC):G(th.root)):G(col);sw=Math.max(sw,1.5);}}
    txt=readable(txt,bgc,4.5);
    if(d===0&&!th.flatRoot) g+=`<rect x="${x}" y="${y+4}" width="${n.w}" height="${n.h}" rx="${rx}" fill="${th.root}" opacity=".22" filter="url(#blur)"/>`;
    g+=`<rect class="hit"${fill==='none'&&stroke==='none'?'':` data-g="node" data-gbg="${CV}"`} x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="${fill==='none'?'transparent':fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    if(d>=2&&!root.boxed&&th.deep!=='plain'&&edge!=='bracket') g+=`<line data-g="edge" data-gbg="${CV}" x1="${x}" y1="${y+n.h}" x2="${x+n.w}" y2="${y+n.h}" stroke="${G(col)}" stroke-width="${Math.max(2,minW)}" stroke-linecap="round"/>`;
    if(opt.lod&&d>=2){g+=`<rect x="${x+n.padX}" y="${n.y-4}" width="${Math.max(10,(n.w-2*n.padX)*.8)}" height="8" rx="4" data-g="lod" data-gbg="${bgc}" fill="${G(mix(bgc,col,.45),bgc)}"/>`; body+=`<g class="node" data-id="${n.id}">${g}</g>`; return;}
    const F=fontOf(d,th); let cx=x+n.padX; const fs=fsOf(d), ry=n.y+(n.ih||0)/2, ty=ry+fs*.36;
    if(n.ib){ const iw=n.ib.w, ih=n.ib.h, ix=n.x-iw/2, iy=y+(d===0?8:6); const cid='ic'+String(n.id).replace(/[^\w-]/g,''); defs+=`<clipPath id="${cid}"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="6"/></clipPath>`;
      g+=`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="6" fill="${th.dark?'#2A2E36':'#F2F3F5'}"/><image href="${esc(n.img.src)}" x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"><title>${esc(n.img.alt||'圖片')}</title></image><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="6" fill="none" stroke="${th.dark?'#4A505C':'#D5D9DF'}" stroke-width="1"/>`; }
    if(n.pri){g+=`<circle data-g="badge" data-gbg="${bgc}" cx="${cx+9}" cy="${ry}" r="9" fill="${PRI[n.pri]}"/><text x="${cx+9}" y="${ry+4}" font-size="11.5" font-weight="700" fill="#FFFFFF" data-bg="${PRI[n.pri]}" text-anchor="middle">${n.pri}</text>`; cx+=24;}
    if(n.done){g+=`<circle data-g="badge" data-gbg="${bgc}" cx="${cx+9}" cy="${ry}" r="9" fill="#0E7A56"/><path data-g="icon" data-gbg="#0E7A56" d="M${cx+5},${ry} l3,3 l5,-6" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round"/>`; cx+=24;}
    if(n.icon){g+=`<text x="${cx}" y="${ty}" font-size="${fs}" aria-hidden="true">${esc(n.icon)}</text>`; cx+=fs*1.15+6;}
    const TW=n.lines?Math.max(...n.lines.map(l=>tw(l,F))):tw(n.t||' ',F);
    if(n.hl&&th.hl!==undefined){const hl=typeof n.hl==='string'?n.hl:(th.hl||'#FFE27A'); g+=`<rect x="${cx-4}" y="${ry-fs*.72-n.lh/2}" width="${TW+8}" height="${fs*1.44+n.lh}" rx="4" fill="${hl}" data-g="hl" data-gbg="${bgc}" stroke="${readable(mix(hl,'#000000',.2),bgc,3)}" stroke-width="1"/>`; txt=readable(th.text,hl,4.5); bgc=hl;}
    else if(n.hl){const hl=typeof n.hl==='string'?n.hl:'#FFE27A'; g+=`<rect x="${cx-4}" y="${ry-fs*.72-n.lh/2}" width="${TW+8}" height="${fs*1.44+n.lh}" rx="4" fill="${hl}" data-g="hl" data-gbg="${bgc}" stroke="${readable(mix(hl,'#000000',.2),bgc,3)}" stroke-width="1"/>`; txt=readable('#1F2329',hl,4.5); bgc=hl;}
    g+=n.lines?`<text x="${cx}" y="${ty-n.lh/2}" font-size="${fs}" font-weight="${fw}" fill="${txt}" data-bg="${bgc}"><tspan x="${cx}">${esc(n.lines[0])}</tspan><tspan x="${cx}" dy="${n.lh}">${esc(n.lines[1])}</tspan></text>`
      :`<text x="${cx}" y="${ty}" font-size="${fs}" font-weight="${fw}" fill="${txt}" data-bg="${bgc}">${esc(n.t||'')}</text>`;
    cx+=TW;
    { const chips=tagChips(n); if(chips.length) cx+=2; chips.forEach(tg=>{ const w=tw(tg,TAGF)+16, tbg=tint(col0,.16,bgc), tfg=readable(col0,tbg,4.6);
      g+=`<rect x="${cx+6}" y="${ry-10}" width="${w}" height="20" rx="10" fill="${tbg}" data-g="tag" data-gbg="${bgc}" stroke="${readable(col0,bgc,3)}" stroke-width="1"/><text x="${cx+14}" y="${ry+4}" font-size="11.5" font-weight="600" fill="${tfg}" data-bg="${tbg}">${esc(tg)}</text>`; cx+=w+6; }); }
    if(n.link){ const tch=typeof matchMedia==='function'&&matchMedia('(max-width:768px),(pointer:coarse)').matches; const LH=Math.max(22,44/(opt.sc||1)); g+=(tch?`<g class="linkic linkhit" role="button" data-link="${n.id}" aria-label="連結：在詳情裡查看或開啟"><rect x="${cx+14-LH/2}" y="${ry-LH/2}" width="${LH}" height="${LH}" fill="transparent"/>`:`<a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer" class="linkic" aria-label="開啟連結：${esc(n.link)}"><rect x="${cx+3}" y="${ry-11}" width="22" height="22" fill="transparent"/>`)+`<g data-g="icon" data-gbg="${bgc}" transform="translate(${cx+6},${ry-8}) scale(.68)" stroke="${readable(th.dark?'#8B9BFF':'#3F51E8',bgc,3)}" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="${P.link}"/></g>`+(tch?'</g>':'</a>'); cx+=22;}
    if(n.note){g+=`<g class="noteic" data-g="icon" data-gbg="${bgc}" transform="translate(${cx+6},${ry-8}) scale(.68)" stroke="${readable(th.dark?'#A3AAB6':'#646A73',bgc,3)}" fill="none" stroke-width="2" stroke-linecap="round"><path d="${P.note}"/></g>`;}
    if(n.collapsed&&n.c&&n.c.length){const ccx=n.x+(n.side===-1?-1:1)*(n.w/2+14), ccy=n.y, cfg=readable(col,nodeBg,4.5);
      g+=`<g class="cc" role="button" aria-label="展開 ${countDesc(n)} 個隱藏節點"><circle data-g="collapse" data-gbg="${CV}" cx="${ccx}" cy="${ccy}" r="10" fill="${nodeBg}" stroke="${G(col)}" stroke-width="1.6"/><text x="${ccx}" y="${ccy+4}" font-size="11.5" font-weight="700" fill="${cfg}" data-bg="${nodeBg}" text-anchor="middle">${countDesc(n)}</text></g>`;}
    if(opt.drop===n.id) g=`<rect x="${x-6}" y="${y-6}" width="${n.w+12}" height="${n.h+12}" rx="${rx+5}" fill="none" stroke="${SEL}" stroke-width="2" stroke-dasharray="5 4"/>`+g;
    if(opt.hits&&opt.hits.has(n.id)&&!opt.thumb){ const cur=opt.cur===n.id, HIT=readable(lum(CV)>.35?'#C2410C':'#FFB347',CV,3);
      g=`<rect class="findhit${cur?' cur':''}" x="${x-9}" y="${y-9}" width="${n.w+18}" height="${n.h+18}" rx="${rx+8}" fill="${cur?'#FFB34733':'#FFD54A26'}" data-g="hit" data-gbg="${CV}" stroke="${HIT}" stroke-width="${cur?3:1.6}"${cur?'':' stroke-dasharray="5 4"'}/>`+g; }
    if(opt.sel===n.id&&!opt.thumb){
      g=`<rect x="${x-5}" y="${y-5}" width="${n.w+10}" height="${n.h+10}" rx="${rx+4}" fill="${SEL}10" data-g="select" data-gbg="${CV}" stroke="${SEL}" stroke-width="2"/>`+g;
      const hx=n.x+(n.side===-1?-1:1)*(n.w/2+(n.collapsed&&n.c&&n.c.length?44:22)), hy=n.y, hr=opt.sc?Math.max(18,(opt.mobile?22:16)/opt.sc):18;
      g+=`<g class="handle" role="button" aria-label="新增子主題"><circle cx="${hx}" cy="${hy}" r="${hr}" fill="transparent"/><circle data-g="handle" data-gbg="${CV}" cx="${hx}" cy="${hy}" r="11" fill="${SEL}"/><path data-g="icon" data-gbg="${SEL}" d="M${hx-4.5},${hy}h9M${hx},${hy-4.5}v9" stroke="${SELK}" stroke-width="2" stroke-linecap="round"/></g>`;}
    body+=`<g class="node" data-id="${n.id}" role="treeitem" aria-level="${d+1}" aria-label="${esc(n.t)}"${n.c&&n.c.length?` aria-expanded="${!n.collapsed}"`:''}${opt.sel===n.id?' aria-selected="true"':''}>${g}</g>`;
  });
  return {svg:`<defs><filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>${defs}</defs><g class="edges">${edges}</g>${body}${R.labels}`,b:relBounds(root,bounds(root))};
}
export function thumbSvg(data,th,pad=30,st={}){const r=layout(JSON.parse(JSON.stringify(data)),th,st);const {svg,b}=renderMap(r,th,{thumb:true});return `<svg viewBox="${b.x0-pad} ${b.y0-pad*.75} ${b.w+pad*2} ${b.h+pad*1.5}" aria-hidden="true">${svg}</svg>`;}
export function themeThumb(th){const c=th.br, g=x=>readable(x,th.canvas,3), gb=`data-gbg="${th.canvas}"`;
  return `<svg viewBox="0 0 120 62" aria-hidden="true"><rect width="120" height="62" fill="${th.canvas}"/>
  ${[[18,16],[18,46],[102,16],[102,46]].map(([x,y],i)=>`<path d="M${x<60?48:72},31 C${x<60?36:84},31 ${x<60?36:84},${y} ${x<60?30:90},${y}" data-g="edge" ${gb} stroke="${g(th.line||c[i])}" stroke-width="2" fill="none"/>`).join('')}
  <rect x="44" y="23" width="32" height="16" rx="5" data-g="node" ${gb} fill="${th.root}" stroke="${cr(th.root,th.canvas)<3?g(th.line||th.root):'none'}" stroke-width="1.2"/>
  ${[[6,10],[6,40],[90,10],[90,40]].map(([x,y],i)=>`<rect data-g="node" ${gb} x="${x}" y="${y}" width="24" height="12" rx="4" fill="${th.l1==='solid'?c[i]:th.l1==='outline'?(th.dark?'#1E2128':'#fff'):tint(c[i],.18,th.canvas)}" stroke="${g(c[i])}" stroke-width="1.2"/>`).join('')}</svg>`;}

// ---------- v1.5 relationship lines (cross-branch links) ----------
// Stored on the root as root.rels=[{id,a,b,label}] so they ride along with undo, sync, merge and every export.
export const relsOf=root=>Array.isArray(root.rels)?root.rels.filter(r=>r&&r.id&&r.a&&r.b&&r.a!==r.b):[];
const RELF=`600 12.5px ${FF}`;
function edgePt(n,tx,ty){ const dx=tx-n.x, dy=ty-n.y; if(!dx&&!dy) return [n.x,n.y]; const k=Math.min((n.w/2+4)/Math.abs(dx||1e-9),(n.h/2+4)/Math.abs(dy||1e-9)); return [n.x+dx*k,n.y+dy*k]; }
// geometry for one relationship: a gentle cubic curve bowed to one side, starting/ending on the node boxes
export function relGeom(A,B,nodes=[]){ const ax=A.x,ay=A.y,bx=B.x,by=B.y, dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1; let nx=-dy/L, ny=dx/L, h;
  if(Math.abs(dx)<(A.w+B.w)/2){ // stacked (same column): bow outwards, clear of the column's widest box
    const out=(A.side===-1&&B.side===-1)?-1:1; if(Math.sign(nx)!==out){nx=-nx;ny=-ny;} h=Math.max(Math.min(150,L*.28)+24,Math.max(A.w,B.w)/2+40);
    // clear every box stacked between the two ends (they can be wider than the ends): the curve's peak is ~.75h from the chord
    const y0=Math.min(ay,by), y1=Math.max(ay,by), cx=(ax+bx)/2; let edge=null; nodes.forEach(n=>{ if(n===A||n===B||n.x===undefined||n.y<=y0||n.y>=y1) return; if(Math.abs(n.x-cx)>n.w/2+Math.max(A.w,B.w)) return; const e=out>0?n.x+n.w/2:n.x-n.w/2; edge=edge===null?e:(out>0?Math.max(edge,e):Math.min(edge,e)); });
    if(edge!==null) h=Math.max(h,(Math.abs(edge-cx)+18)/.75); }
  else { if(ny>0||(Math.abs(ny)<1e-6&&nx<0)){nx=-nx;ny=-ny;} h=Math.min(80,L*.18)+16; } // side by side: a low arc above, under the parent row gap
  const c1=[ax+dx/3+nx*h,ay+dy/3+ny*h], c2=[ax+dx*2/3+nx*h,ay+dy*2/3+ny*h];
  const p0=edgePt(A,c1[0],c1[1]), p3=edgePt(B,c2[0],c2[1]); const mid=[(p0[0]+3*c1[0]+3*c2[0]+p3[0])/8,(p0[1]+3*c1[1]+3*c2[1]+p3[1])/8];
  return {d:`M${p0[0].toFixed(1)},${p0[1].toFixed(1)} C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p3[0].toFixed(1)},${p3[1].toFixed(1)}`,mid,box:[Math.min(p0[0],p3[0],mid[0]),Math.min(p0[1],p3[1],mid[1]),Math.max(p0[0],p3[0],mid[0]),Math.max(p0[1],p3[1],mid[1])]}; }
function relEnds(root){ const vis=new Set(all(root).map(n=>n.id)), by=new Map(); allDeep(root).forEach(n=>by.set(n.id,n));
  const up=id=>{ let n=by.get(id), moved=false; while(n&&!vis.has(n.id)){ n=n.parent; moved=true; } return n?{n,moved}:null; };
  return relsOf(root).map(r=>{ const A=up(r.a), B=up(r.b); return A&&B&&A.n!==B.n?{r,A:A.n,B:B.n,hidden:A.moved||B.moved}:null; }).filter(Boolean); }
export const relAccent=th=>th.rel||th.line||th.br[0];
function relsSvg(root,th,opt,{CV,G,SEL,minW}){ const list=relEnds(root); if(!list.length) return {defs:'',lines:'',labels:''};
  const col=G(relAccent(th)), key=col.slice(1), selC=SEL; let lines='',labels='';
  const defs=`<marker id="rela-${key}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0,0.8 L10,5 L0,9.2 z" fill="${col}"/></marker><marker id="relas-${key}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0.8 L10,5 L0,9.2 z" fill="${selC}"/></marker>`;
  const hitW=Math.max(12,(opt.mobile?30:16)/(opt.sc||1));
  const vis=all(root); list.forEach(({r,A,B,hidden})=>{ const g=relGeom(A,B,vis), sel=opt.selRel===r.id&&!opt.thumb, c=sel?selC:col, w=Math.max(sel?2.6:1.8,minW);
    const lbl=String(r.label||'').trim(), name=`關聯線：${A.t||''} → ${B.t||''}${lbl?'（'+lbl+'）':''}${hidden?'，端點在收合的分支裡':''}`;
    lines+=`<g class="rel${sel?' sel':''}" data-rel="${esc(r.id)}" role="button" aria-label="${esc(name)}"${hidden?' opacity=".6"':''}>${opt.thumb?'':`<path class="relhit" d="${g.d}" fill="none" stroke="transparent" stroke-width="${hitW.toFixed(1)}"/>`}${sel?`<path d="${g.d}" fill="none" stroke="${selC}" stroke-opacity=".18" stroke-width="${(w+6).toFixed(1)}" stroke-linecap="round"/>`:''}<path data-g="rel" data-gbg="${CV}" d="${g.d}" fill="none" stroke="${c}" stroke-width="${w.toFixed(2)}" stroke-dasharray="7 5" stroke-linecap="round" marker-end="url(#${sel?'relas':'rela'}-${key})"/></g>`;
    if(lbl){ const t=lbl.length>24?lbl.slice(0,23)+'…':lbl, tw0=tw(t,RELF), W=tw0+18, H=24, x=g.mid[0]-W/2, y=g.mid[1]-H/2, tc=readable(th.text,CV,4.5);
      labels+=`<g class="rel rellbl${sel?' sel':''}" data-rel="${esc(r.id)}" aria-hidden="true"><rect data-g="rel" data-gbg="${CV}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${W.toFixed(1)}" height="${H}" rx="12" fill="${CV}" stroke="${c}" stroke-width="${sel?2:1.2}"/><text x="${g.mid[0].toFixed(1)}" y="${(g.mid[1]+4.4).toFixed(1)}" font-size="12.5" font-weight="600" fill="${tc}" data-bg="${CV}" text-anchor="middle">${esc(t)}</text></g>`; } });
  return {defs,lines,labels}; }
function relBounds(root,b){ const list=relEnds(root); if(!list.length) return b; let {x0,y0,x1,y1}=b; const vis=all(root); list.forEach(({A,B,r})=>{ const g=relGeom(A,B,vis); const lw=r.label?tw(String(r.label).slice(0,24),RELF)/2+12:0; x0=Math.min(x0,g.box[0]-lw); y0=Math.min(y0,g.box[1]-14); x1=Math.max(x1,g.box[2]+lw); y1=Math.max(y1,g.box[3]+14); }); return {x0,y0,x1,y1,w:x1-x0,h:y1-y0}; }
