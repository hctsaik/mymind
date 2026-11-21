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

function prep(n,d,br,boxed,th,par){
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
  if(n.tag) w+=tw(n.tag,`600 11.5px ${FF}`)+16+8; if(n.note) w+=22;
  n.w=Math.ceil(w+padX*2); n.h=(d===0?58:d===1?42:(boxed?34:32))+n.lh; n.padX=padX;
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
export function layout(root,th,st={}){
  const boxed=!!th.deepBox; const [hg,g]=SPACING[st.spacing||'standard']||SPACING.standard;
  prep(root,0,0,boxed,th,null); root.boxed=boxed;
  placeH(root,0,-subH(root,g)/2,hg,g);
  if((st.rootTop??th.rootTop)&&kids(root).length){root.y=kids(root)[0].y;}
  return root;
}
export function bounds(root){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;all(root).forEach(n=>{x0=Math.min(x0,n.x-n.w/2);x1=Math.max(x1,n.x+n.w/2+(n.collapsed&&n.c&&n.c.length?28:0));y0=Math.min(y0,n.y-n.h/2);y1=Math.max(y1,n.y+n.h/2)});return{x0,y0,x1,y1,w:x1-x0,h:y1-y0};}
export function colorOf(n,th){return n.d===0?th.root:th.br[n.br%th.br.length]}

/* opt: {sel:id, lightLines:bool, sc:number (current zoom, for minimum visual line width), thumb, edge:'bracket'|'curve'|'straight', lw:'thin'|'standard'|'thick', lod, drop:id} */
export function renderMap(root,th,opt={}){
  const nodes=all(root); let edges='',body='';
  const nodeBg=th.dark?'#1E2128':'#FFFFFF';
  const CV=th.canvas, LIGHT=!!(opt.lightLines&&th.lineLight&&!opt.thumb), G=(c,bg=CV)=>LIGHT?c:readable(c,bg,3);
  const SEL=lum(CV)>.35?'#3F51E8':'#8B9BFF', SELK=lum(CV)>.35?'#FFFFFF':'#0E1020';
  const lineC=LIGHT?th.lineLight:th.line, brC=n=>LIGHT?th.lineLight:G(colorOf(n,th));
  const edge=opt.edge||th.edge||'curve', mult={thin:.75,standard:1,thick:1.5}[opt.lw||'standard']||1;
  // minimum visual line width: never thinner than 1.5 CSS px on screen, whatever the zoom (review r4 dev-suggestion 3)
  const minW=opt.sc?1.5/opt.sc:0;
  nodes.forEach(n=>[...kids(n)].sort((a,b)=>Math.abs(b.y-n.y)-Math.abs(a.y-n.y)).forEach(c=>{
    const col=colorOf(c,th); let p='';
    const x1=n.x+n.w/2-(th.deep==='plain'&&n.d>=2?(n.padX-5):0), x2=c.x-c.w/2+(th.deep==='plain'&&c.d>=2?(c.padX-5):0);
    if(edge==='bracket'){
      const xm=x1+(x2-x1)*.5, dy=c.y-n.y, r=Math.min(th.er||8,Math.abs(dy)), sg=Math.sign(dy);
      p=Math.abs(dy)<1?`M${x1},${n.y} H${x2}`:`M${x1},${n.y} H${xm} V${c.y-sg*r} Q${xm},${c.y} ${xm+r},${c.y} H${x2}`;
    } else if(edge==='straight'){ p=`M${x1},${n.y} L${x2},${c.y}`; }
    else { const under=c.d>=2&&!root.boxed&&th.deep!=='plain'; const y2=under?c.y+c.h/2:c.y, sx=n.d===0? n.x+(n.w/2-10):x1, xe=c.x-c.w/2, dx=(xe-sx)*.5;
      p=`M${sx},${n.y} C${sx+dx},${n.y} ${xe-dx},${y2} ${xe},${y2}`; if(under) p+=` L${c.x+c.w/2},${y2}`; }
    const base=th.lw||(th.line?(n.d===0?1.8:1.2):(edge==='bracket'?(n.d===0?2.6:1.6):(n.d===0?3.2:2)));
    edges+=`<path data-g="edge" data-gbg="${CV}" d="${p}" fill="none" stroke="${lineC?G(lineC):G(col)}" stroke-width="${Math.max(base*mult,minW).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }));
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
    const F=fontOf(d,th); let cx=x+n.padX; const fs=fsOf(d), ty=n.y+fs*.36;
    if(n.pri){g+=`<circle data-g="badge" data-gbg="${bgc}" cx="${cx+9}" cy="${n.y}" r="9" fill="${PRI[n.pri]}"/><text x="${cx+9}" y="${n.y+4}" font-size="11.5" font-weight="700" fill="#FFFFFF" data-bg="${PRI[n.pri]}" text-anchor="middle">${n.pri}</text>`; cx+=24;}
    if(n.done){g+=`<circle data-g="badge" data-gbg="${bgc}" cx="${cx+9}" cy="${n.y}" r="9" fill="#0E7A56"/><path data-g="icon" data-gbg="#0E7A56" d="M${cx+5},${n.y} l3,3 l5,-6" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round"/>`; cx+=24;}
    if(n.icon){g+=`<text x="${cx}" y="${ty}" font-size="${fs}" aria-hidden="true">${esc(n.icon)}</text>`; cx+=fs*1.15+6;}
    const TW=n.lines?Math.max(...n.lines.map(l=>tw(l,F))):tw(n.t||' ',F);
    if(n.hl&&th.hl!==undefined){const hl=typeof n.hl==='string'?n.hl:(th.hl||'#FFE27A'); g+=`<rect x="${cx-4}" y="${n.y-fs*.72-n.lh/2}" width="${TW+8}" height="${fs*1.44+n.lh}" rx="4" fill="${hl}" data-g="hl" data-gbg="${bgc}" stroke="${readable(mix(hl,'#000000',.2),bgc,3)}" stroke-width="1"/>`; txt=readable(th.text,hl,4.5); bgc=hl;}
    else if(n.hl){const hl=typeof n.hl==='string'?n.hl:'#FFE27A'; g+=`<rect x="${cx-4}" y="${n.y-fs*.72-n.lh/2}" width="${TW+8}" height="${fs*1.44+n.lh}" rx="4" fill="${hl}" data-g="hl" data-gbg="${bgc}" stroke="${readable(mix(hl,'#000000',.2),bgc,3)}" stroke-width="1"/>`; txt=readable('#1F2329',hl,4.5); bgc=hl;}
    g+=n.lines?`<text x="${cx}" y="${ty-n.lh/2}" font-size="${fs}" font-weight="${fw}" fill="${txt}" data-bg="${bgc}"><tspan x="${cx}">${esc(n.lines[0])}</tspan><tspan x="${cx}" dy="${n.lh}">${esc(n.lines[1])}</tspan></text>`
      :`<text x="${cx}" y="${ty}" font-size="${fs}" font-weight="${fw}" fill="${txt}" data-bg="${bgc}">${esc(n.t||'')}</text>`;
    cx+=TW;
    if(n.tag){const w=tw(n.tag,`600 11.5px ${FF}`)+16, tbg=tint(col0,.16,bgc), tfg=readable(col0,tbg,4.6);
      g+=`<rect x="${cx+8}" y="${n.y-10}" width="${w}" height="20" rx="10" fill="${tbg}" data-g="tag" data-gbg="${bgc}" stroke="${readable(col0,bgc,3)}" stroke-width="1"/><text x="${cx+16}" y="${n.y+4}" font-size="11.5" font-weight="600" fill="${tfg}" data-bg="${tbg}">${esc(n.tag)}</text>`; cx+=w+8;}
    if(n.note){g+=`<g class="noteic" data-g="icon" data-gbg="${bgc}" transform="translate(${cx+6},${n.y-8}) scale(.68)" stroke="${readable(th.dark?'#A3AAB6':'#646A73',bgc,3)}" fill="none" stroke-width="2" stroke-linecap="round"><path d="${P.note}"/></g>`;}
    if(n.collapsed&&n.c&&n.c.length){const ccx=n.x+n.w/2+14, ccy=n.y, cfg=readable(col,nodeBg,4.5);
      g+=`<g class="cc" role="button" aria-label="展開 ${countDesc(n)} 個隱藏節點"><circle data-g="collapse" data-gbg="${CV}" cx="${ccx}" cy="${ccy}" r="10" fill="${nodeBg}" stroke="${G(col)}" stroke-width="1.6"/><text x="${ccx}" y="${ccy+4}" font-size="11.5" font-weight="700" fill="${cfg}" data-bg="${nodeBg}" text-anchor="middle">${countDesc(n)}</text></g>`;}
    if(opt.drop===n.id) g=`<rect x="${x-6}" y="${y-6}" width="${n.w+12}" height="${n.h+12}" rx="${rx+5}" fill="none" stroke="${SEL}" stroke-width="2" stroke-dasharray="5 4"/>`+g;
    if(opt.hits&&opt.hits.has(n.id)&&!opt.thumb){ const cur=opt.cur===n.id, HIT=readable(lum(CV)>.35?'#C2410C':'#FFB347',CV,3);
      g=`<rect class="findhit${cur?' cur':''}" x="${x-9}" y="${y-9}" width="${n.w+18}" height="${n.h+18}" rx="${rx+8}" fill="${cur?'#FFB34733':'#FFD54A26'}" data-g="hit" data-gbg="${CV}" stroke="${HIT}" stroke-width="${cur?3:1.6}"${cur?'':' stroke-dasharray="5 4"'}/>`+g; }
    if(opt.sel===n.id&&!opt.thumb){
      g=`<rect x="${x-5}" y="${y-5}" width="${n.w+10}" height="${n.h+10}" rx="${rx+4}" fill="${SEL}10" data-g="select" data-gbg="${CV}" stroke="${SEL}" stroke-width="2"/>`+g;
      const hx=n.x+n.w/2+(n.collapsed&&n.c&&n.c.length?44:22), hy=n.y, hr=opt.sc?Math.max(18,(opt.mobile?22:16)/opt.sc):18;
      g+=`<g class="handle" role="button" aria-label="新增子主題"><circle cx="${hx}" cy="${hy}" r="${hr}" fill="transparent"/><circle data-g="handle" data-gbg="${CV}" cx="${hx}" cy="${hy}" r="11" fill="${SEL}"/><path data-g="icon" data-gbg="${SEL}" d="M${hx-4.5},${hy}h9M${hx},${hy-4.5}v9" stroke="${SELK}" stroke-width="2" stroke-linecap="round"/></g>`;}
    body+=`<g class="node" data-id="${n.id}" role="treeitem" aria-level="${d+1}" aria-label="${esc(n.t)}"${n.c&&n.c.length?` aria-expanded="${!n.collapsed}"`:''}${opt.sel===n.id?' aria-selected="true"':''}>${g}</g>`;
  });
  return {svg:`<defs><filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8"/></filter></defs><g class="edges">${edges}</g>${body}`,b:bounds(root)};
}
export function thumbSvg(data,th,pad=30){const r=layout(JSON.parse(JSON.stringify(data)),th);const {svg,b}=renderMap(r,th,{thumb:true});return `<svg viewBox="${b.x0-pad} ${b.y0-pad*.75} ${b.w+pad*2} ${b.h+pad*1.5}" aria-hidden="true">${svg}</svg>`;}
export function themeThumb(th){const c=th.br, g=x=>readable(x,th.canvas,3), gb=`data-gbg="${th.canvas}"`;
  return `<svg viewBox="0 0 120 62" aria-hidden="true"><rect width="120" height="62" fill="${th.canvas}"/>
  ${[[18,16],[18,46],[102,16],[102,46]].map(([x,y],i)=>`<path d="M${x<60?48:72},31 C${x<60?36:84},31 ${x<60?36:84},${y} ${x<60?30:90},${y}" data-g="edge" ${gb} stroke="${g(th.line||c[i])}" stroke-width="2" fill="none"/>`).join('')}
  <rect x="44" y="23" width="32" height="16" rx="5" data-g="node" ${gb} fill="${th.root}" stroke="${cr(th.root,th.canvas)<3?g(th.line||th.root):'none'}" stroke-width="1.2"/>
  ${[[6,10],[6,40],[90,10],[90,40]].map(([x,y],i)=>`<rect data-g="node" ${gb} x="${x}" y="${y}" width="24" height="12" rx="4" fill="${th.l1==='solid'?c[i]:th.l1==='outline'?(th.dark?'#1E2128':'#fff'):tint(c[i],.18,th.canvas)}" stroke="${g(c[i])}" stroke-width="1.2"/>`).join('')}</svg>`;}
