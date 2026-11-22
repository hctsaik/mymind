// v1.9 概要 (summary brackets) and 外框 (boundaries). Geometry only: the renderers draw what this computes.
// Data: a host node keeps  sm:[{id,a,b,t,c,…topic fields}]  (a summary topic over its children a…b, a real node with children)
//       and                bd:[{id,a,b,t,col}]                (a boundary around its children a…b, or a=b=host.id for the host itself)
const kidsOf=n=>(n.collapsed||!n.c)?[]:n.c;
export const smOf=n=>Array.isArray(n.sm)?n.sm.filter(s=>s&&s.id):[];
export const bdOf=n=>Array.isArray(n.bd)?n.bd.filter(s=>s&&s.id):[];
export function rangeIdx(n,a,b){ const c=n.c||[]; const i=c.findIndex(x=>x.id===a), j=c.findIndex(x=>x.id===b); if(i<0||j<0) return null; return [Math.min(i,j),Math.max(i,j)]; }
export const BD_COLORS=['#3E63DD','#2F9E44','#E8590C','#8E4EC6','#D93025','#0C8599','#8B8D98'];
const subAll=(n,a=[])=>{ a.push(n); kidsOf(n).forEach(c=>subAll(c,a)); (n._sv||[]).forEach(c=>subAll(c,a)); return a; };
export function boxOf(list){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; list.forEach(n=>{ const cc=n.collapsed&&n.c&&n.c.length?28:0;
  x0=Math.min(x0,n.x-n.w/2-(n.side===-1?cc:0)); x1=Math.max(x1,n.x+n.w/2+(n.side===-1?0:cc)); y0=Math.min(y0,n.y-n.h/2); y1=Math.max(y1,n.y+n.h/2); }); return {x0,y0,x1,y1}; }
// curly bracket from (x,y0) to (x,y1) bulging towards s (±1), or horizontal under a row when s===2
export function bracePath(x0,y0,x1,y1,s){ const W=7;
  if(s===2){ const y=y0, L=x1-x0, r=Math.min(8,L/4), xm=(x0+x1)/2; return {d:`M${x0},${y} Q${x0},${y+W} ${x0+r},${y+W} L${xm-r},${y+W} Q${xm},${y+W} ${xm},${y+2*W} Q${xm},${y+W} ${xm+r},${y+W} L${x1-r},${y+W} Q${x1},${y+W} ${x1},${y}`,tip:[xm,y+2*W]}; }
  const x=x0, L=y1-y0, r=Math.min(8,L/4), ym=(y0+y1)/2, k=s*W;
  return {d:`M${x},${y0} Q${x+k},${y0} ${x+k},${y0+r} L${x+k},${ym-r} Q${x+k},${ym} ${x+2*k},${ym} Q${x+k},${ym} ${x+k},${ym+r} L${x+k},${y1-r} Q${x+k},${y1} ${x},${y1}`,tip:[x+2*k,ym]}; }
// eng: {size(topic,d,br,host), place(topic,leftX|centreX,cy,side,below)}  — engine specific sizing and subtree placement
export function placeExtras(root,eng){ const deco={br:[],bd:[]};
  const walk=n=>{ kidsOf(n).forEach(walk); n._sv=[];
    for(const s of smOf(n)){ const r=rangeIdx(n,s.a,s.b); if(!r||n.collapsed) continue; let rng=(n.c||[]).slice(r[0],r[1]+1); if(rng.some(c=>c.x===undefined)) continue; rng=rng.filter(c=>c.side===rng[0].side); // a range split by the balanced layout keeps the first side
      const b=boxOf(rng.flatMap(c=>subAll(c))), f=rng[0], side=f.side===3?2:f.side===-1?-1:1;
      eng.size(s,f.d,f.br,n); s.isSum=true; s.host=n.id;
      if(side===2){ const y=b.y1+16, br=bracePath(b.x0,y,b.x1,y,2); eng.place(s,br.tip[0],br.tip[1]+10,2); deco.br.push({id:s.id,d:br.d,ref:f}); }
      else { const x=side>0?b.x1+18:b.x0-18, br=bracePath(x,b.y0,x,b.y1,side); eng.place(s,br.tip[0]+side*12,br.tip[1],side); deco.br.push({id:s.id,d:br.d,ref:f}); }
      n._sv.push(s); walk(s); } };
  walk(root);
  const bds=[]; const visit=n=>{ for(const e of bdOf(n)){ let rng; if(e.a===n.id) rng=[n]; else { const r=rangeIdx(n,e.a,e.b); if(!r||n.collapsed) continue; rng=(n.c||[]).slice(r[0],r[1]+1); }
      if(rng.some(c=>c.x===undefined)) continue; const b=boxOf(rng.flatMap(c=>subAll(c))), P=10; bds.push({id:e.id,host:n.id,t:e.t||'',col:e.col||'',ref:rng[0],x0:b.x0-P,y0:b.y0-P,x1:b.x1+P,y1:b.y1+P}); }
    kidsOf(n).forEach(visit); (n._sv||[]).forEach(visit); };
  visit(root);
  bds.sort((p,q)=>(q.x1-q.x0)*(q.y1-q.y0)-(p.x1-p.x0)*(p.y1-p.y0)); deco.bd=bds; root._deco=deco; return root; }
// extra room for bounds(): boundary rectangles and their labels
export function decoBounds(root,b){ const D=root._deco; if(!D) return b; let {x0,y0,x1,y1}=b;
  D.bd.forEach(r=>{ x0=Math.min(x0,r.x0); x1=Math.max(x1,r.x1); y0=Math.min(y0,r.y0-(r.t?14:0)); y1=Math.max(y1,r.y1); });
  return {x0,y0,x1,y1,w:x1-x0,h:y1-y0}; }
// keep entries valid after edits: drop ends that no longer exist among the host's children, drop empty lists
export function pruneExtras(n){ (n.c||[]).forEach(pruneExtras); smOf(n).forEach(pruneExtras);
  for(const k of ['sm','bd']){ if(!Array.isArray(n[k])) continue; n[k]=n[k].filter(e=>{ if(!e||!e.id) return false; if(k==='bd'&&e.a===n.id) return true;
      const ids=new Set((n.c||[]).map(c=>c.id)); if(!ids.has(e.a)&&ids.has(e.b)) e.a=e.b; if(!ids.has(e.b)&&ids.has(e.a)) e.b=e.a; return ids.has(e.a)&&ids.has(e.b); });
    if(!n[k].length) delete n[k]; } }
