// In-page audit functions ported from the design-gate scripts (design/audit.mjs, gfx.mjs, check.mjs).
export const CONTRAST=()=>{ // runs in page
  const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return [a[0],a[1],a[2],a.length>3?a[3]:1]};
  const hexP=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).concat(1);
  const L=c=>{const v=c.slice(0,3).map(x=>x/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]};
  const R=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const over=(top,bot)=>{const a=top[3];return [0,1,2].map(i=>top[i]*a+bot[i]*(1-a)).concat(1)};
  const gradStops=s=>(s.match(/rgba?\([^)]+\)/g)||[]).map(parse);
  function bgOf(el){const layers=[];let e=el;while(e&&e.nodeType===1){const cs=getComputedStyle(e);
      if(cs.backgroundImage&&cs.backgroundImage.includes('linear-gradient')&&!cs.backgroundImage.includes('radial')){return {grad:gradStops(cs.backgroundImage),layers}}
      const c=parse(cs.backgroundColor);if(c&&c[3]>0){layers.push(c);if(c[3]>=1)break;} e=e.parentElement;}
    let base=[255,255,255,1];for(let i=layers.length-1;i>=0;i--)base=over(layers[i],base);return {solid:base};}
  const vis=el=>{const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)return false;let e=el;while(e&&e.nodeType===1){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return false;if(cs.clip&&cs.clip.startsWith('rect(0'))return false;e=e.parentElement;}return true};
  const res=[];
  // HTML text
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
  while(n=walker.nextNode()){const t=n.textContent.trim();if(!t)continue;const el=n.parentElement;if(!el||el.closest('svg')||el.closest('script,style,select'))continue;if(!vis(el))continue;
    if(/^[\p{Extended_Pictographic}\uFE0F\s]+$/u.test(t))continue;
    const cs=getComputedStyle(el);const fg=parse(cs.color);const fs=parseFloat(cs.fontSize),fw=+cs.fontWeight;const large=fs>=24||(fs>=18.66&&fw>=700);
    const bg=bgOf(el);let ratio;
    if(bg.grad){ratio=Math.min(...bg.grad.map(g=>R(over(fg,g),g)))}else{ratio=R(over(fg,bg.solid),bg.solid)}
    res.push({t:t.slice(0,30),fs,fw,ratio:+ratio.toFixed(2),need:large?3:4.5,cls:el.className&&el.className.baseVal===undefined?el.className:''});}
  // SVG text with data-bg (only inside main map / thumbs)
  document.querySelectorAll('text[data-bg]').forEach(t=>{if(!vis(t))return;const fg=hexP(t.getAttribute('fill'));const bg=hexP(t.getAttribute('data-bg'));const fs=+t.getAttribute('font-size');const fw=+(t.getAttribute('font-weight')||400);
    res.push({t:'[svg] '+t.textContent.slice(0,24),fs,fw,ratio:+R(fg,bg).toFixed(2),need:(fs>=24||(fs>=18.66&&fw>=700))?3:4.5});});
  return res;
};
export const TAP=()=>{const vis=el=>{const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;if(r.bottom<0||r.top>innerHeight)return false;let e=el;while(e&&e.nodeType===1){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return false;e=e.parentElement;}return true};
  const els=[...document.querySelectorAll('button,a[href],select,input,summary,[role=button],[role=switch],[role=tab],[role=radio],textarea')].filter(vis).filter(e=>!e.classList.contains('skip')&&!(e.tagName==='INPUT'&&e.closest('label.search')));
  // inputs inside .search labels: measure the label instead
  const labels=[...document.querySelectorAll('label.search')].filter(vis);
  return [...els,...labels].map(e=>{const r=e.getBoundingClientRect();return {el:(e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,22),w:Math.round(r.width),h:Math.round(r.height)}});};
export const GFX = () => {
  const parse=s=>{if(!s)return null;s=s.trim();if(s.startsWith('#')){if(s.length!==7)return null;return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)).concat(1);}const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return [a[0],a[1],a[2],a.length>3?a[3]:1]};
  const L=c=>{const v=c.slice(0,3).map(x=>x/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]};
  const R=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const over=(t,u)=>{const a=t[3];return [0,1,2].map(i=>t[i]*a+u[i]*(1-a)).concat(1)};
  const vis=el=>{const r=el.getBoundingClientRect();if(r.width<1&&r.height<1)return false;if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)return false;let e=el;while(e&&e.nodeType===1){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return false;e=e.parentElement;}return true};
  function bgOf(el){const layers=[];let e=el;while(e&&e.nodeType===1){const cs=getComputedStyle(e);
      if(cs.backgroundImage&&cs.backgroundImage.includes('linear-gradient')){const st=(cs.backgroundImage.match(/rgba?\([^)]+\)/g)||[]).map(parse);return {grad:st};}
      const c=parse(cs.backgroundColor);if(c&&c[3]>0){layers.push(c);if(c[3]>=1)break;} e=e.parentElement;}
    let base=[255,255,255,1];for(let i=layers.length-1;i>=0;i--)base=over(layers[i],base);return {solid:base};}
  const vsBg=(c,bg)=>bg.grad?Math.min(...bg.grad.map(g=>R(c,g))):R(over(c,bg.solid),bg.solid);
  const lightOpt=new URLSearchParams(location.search).get('lines')==='light';
  const res=[];
  // A. SVG graphics tagged by renderMap/themeThumb (map, thumbnails, minimap, theme cards)
  document.querySelectorAll('[data-g]').forEach(e=>{ if(!vis(e)) return; const kind=e.getAttribute('data-g');
    if(e.closest('.lsample')) return;
    const where=e.closest('#mapsvg')?'map':e.closest('.theme')?'theme-card':e.closest('.minimap')?'minimap':e.closest('.thumb')?'thumb':e.closest('#ovl')?'overview':'other';
    let bg, cands=[];
    if(e.namespaceURI==='http://www.w3.org/2000/svg'){ bg=parse(e.getAttribute('data-gbg'));
      const f=parse(e.getAttribute('fill')), sk=parse(e.getAttribute('stroke')), sw=+(e.getAttribute('stroke-width')||0);
      if(f&&f[3]===1&&e.getAttribute('fill')!=='transparent') cands.push(['fill',f]); if(sk&&sw>=1) cands.push(['stroke',sk]);
      if(!bg) return;
      const best=Math.max(0,...cands.map(c=>R(c[1],bg)));
      res.push({where,kind,ratio:+best.toFixed(2),cands:cands.map(c=>c[0]).join('+'),lightOpt:lightOpt&&(kind==='edge'||kind==='node'||kind==='collapse')});
    } else { // HTML (overview chips, rail segments)
      const cs=getComputedStyle(e); const own=parse(cs.backgroundColor); const pb=bgOf(e.parentElement);
      if(kind==='chip'){const sh=(cs.boxShadow.match(/rgba?\([^)]+\)/)||[])[0]; const c=[own,parse(sh)].filter(Boolean); const best=Math.max(...c.map(x=>R(x,parse(getComputedStyle(document.getElementById('main')).getPropertyValue('--cv-main'))||pb.solid)));res.push({where,kind,ratio:+best.toFixed(2),lightOpt});}
      else {const tr=bgOf(e.parentElement); res.push({where,kind,ratio:+vsBg(own,tr).toFixed(2)});}
    }});
  // also flag painted map shapes that nobody classified
  const unclassified=[...document.querySelectorAll('#mapsvg path,#mapsvg rect,#mapsvg circle,#mapsvg line')].filter(e=>!e.hasAttribute('data-g')&&!e.closest('[data-g]')&&vis(e)).filter(e=>{const f=e.getAttribute('fill'),s=e.getAttribute('stroke');const paintF=f&&f!=='none'&&f!=='transparent'&&!/^#[0-9A-Fa-f]{8}$/.test(f);const paintS=s&&s!=='none'&&+(e.getAttribute('stroke-width')||1)>0;return (paintF||paintS)&&!e.getAttribute('filter')&&!(e.getAttribute('opacity')&&+e.getAttribute('opacity')<.5);}).map(e=>e.outerHTML.slice(0,90));
  // B. UI control boundaries & states
  const UI=[['.search','field'],['.inp','field'],['.sortsel','field'],['.stepper','field'],['.aibar','field'],['.toggle i','switch'],['.sw i','swatch'],['.seg button[aria-pressed=true]','selected'],['.tabs button[aria-selected=true]','selected'],['.radio .dot','radio'],['.radio[aria-checked=true]','selected'],['.theme[aria-pressed=true]','selected'],['.rail .thumb','thumb'],['.minimap .vp','viewport'],['.aibar .send','button'],['.zctl .mm-t[aria-pressed=true]','selected'],['.check li','checkbox']];
  for(const [sel,kind] of UI) document.querySelectorAll(sel).forEach(e=>{ if(!vis(e)) return; const cs=getComputedStyle(kind==='checkbox'?e:e,kind==='checkbox'?'::before':null);
    const pb=bgOf(e.parentElement); const c=[];
    for(const sd of ['Top','Right','Bottom','Left']){const w=parseFloat(cs['border'+sd+'Width']);const col=parse(cs['border'+sd+'Color']);if(w>=1&&col&&col[3]>=.9)c.push(col);}
    const own=parse(cs.backgroundColor); if(own&&own[3]>=.9) c.push(own);
    (cs.boxShadow||'').split(/,(?![^(]*\))/).forEach(sh=>{const col=parse((sh.match(/rgba?\([^)]+\)/)||[])[0]);const nums=sh.replace(/rgba?\([^)]+\)/,'').match(/-?[\d.]+px/g)||[];if(col&&col[3]>=.9&&nums.some(n=>Math.abs(parseFloat(n))>=1.5))c.push(col);});
    const best=c.length?Math.max(...c.map(x=>vsBg(x,pb))):0;
    res.push({where:'ui',kind,sel,ratio:+best.toFixed(2)});});
  // C. icons inside controls (stroke/fill of svg icons vs the control background)
  document.querySelectorAll('button svg.i, a svg.i, [role=button] svg.i, .inp svg.i, .search svg.i, .chip-ok svg.i, .warnbox svg.i, .info svg.i').forEach(sv=>{ if(!vis(sv)||sv.closest('#mapsvg,.thumb,.theme,.lsample')) return;
    const cs=getComputedStyle(sv); const col=parse(cs.stroke!=='none'?cs.stroke:cs.color); if(!col) return; const bg=bgOf(sv);
    res.push({where:'ui',kind:'icon',sel:(sv.closest('button,a,div')?.className||'').toString().slice(0,24),ratio:+vsBg(col,bg).toFixed(2)});});
  return {res,unclassified};
};

// r3 checks run on every shot: chrome-vs-node overlap, first-level visibility, sidebar selection, orphan characters
export const check = () => {
  const vis=e=>{const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
  const R=e=>{const r=e.getBoundingClientRect();return{x0:r.left,y0:r.top,x1:r.right,y1:r.bottom}};
  const I=(a,b)=>({x0:Math.max(a.x0,b.x0),y0:Math.max(a.y0,b.y0),x1:Math.min(a.x1,b.x1),y1:Math.min(a.y1,b.y1)});
  const A=r=>Math.max(0,r.x1-r.x0)*Math.max(0,r.y1-r.y0);
  const out={};
  const VW={x0:0,y0:0,x1:innerWidth,y1:innerHeight};
  const st=document.getElementById('stage');
  if(st&&vis(st)){
    const S=R(st);
    const chrome=[...document.querySelectorAll('.canvas [data-dock], .canvas .cbar > *, .canvas .zctl, .canvas .minimap, .canvas .levels, .canvas .rail, .canvas .mbar, .canvas .stylep, .canvas .sheet, header.top, #side')].filter(vis).map(e=>({n:(e.className.baseVal??e.className)||e.tagName, r:R(e)}));
    const nodes=[...document.querySelectorAll('#mapsvg g.node, #mapsvg g.banner, #ovl .ovchip')].map(e=>({t:e.textContent.trim().slice(0,24), r:R(e)}));
    const ov=[]; let vn=0;
    for(const n of nodes){const v=I(I(n.r,S),VW); if(A(v)<=0) continue; vn++; for(const c of chrome) if(A(I(v,c.r))>0.5) ov.push(n.t+' × '+c.n);}
    out.map={stage:[Math.round(S.x0),Math.round(S.y0),Math.round(S.x1),Math.round(S.y1)], safe:window.__SAFE, chrome:chrome.length, nodesOnScreen:vn, overlaps:ov.length, overlapList:ov.slice(0,10),
      stageVsChrome:chrome.filter(c=>A(I(S,c.r))>0.5).map(c=>c.n)};
    // first-level nodes + root fully inside the stage?
    if(window.__R&&window.__VIEW){const {tx,ty,sc}=window.__VIEW; const k=window.__R.root; const L=[k,...(k.collapsed||!k.c?[]:k.c)];
      const full=L.filter(n=>{const x0=S.x0+tx+(n.x-n.w/2)*sc,x1=S.x0+tx+(n.x+n.w/2)*sc,y0=S.y0+ty+(n.y-n.h/2)*sc,y1=S.y0+ty+(n.y+n.h/2)*sc;return x0>=S.x0-0.5&&x1<=S.x1+0.5&&y0>=S.y0-0.5&&y1<=S.y1+0.5&&y1<=innerHeight;});
      const onRow=L.filter(n=>n!==k&&S.y0+ty+(n.y+n.h/2)*sc>S.y0&&S.y0+ty+(n.y-n.h/2)*sc<Math.min(S.y1,innerHeight));
      out.map.l1OnScreen=onRow.length; out.map.l1HorizClipped=onRow.filter(n=>S.x0+tx+(n.x-n.w/2)*sc<S.x0-0.5||S.x0+tx+(n.x+n.w/2)*sc>S.x1+0.5).map(n=>n.t);
      out.map.rootVisible=full.includes(k); out.map.l1Full=full.filter(n=>n!==k).length; out.map.l1Total=L.length-1; out.map.scale=+sc.toFixed(3);}
  }
  const h1=document.querySelector('header.top h1'), on=document.querySelector('#side .file.on .ft');
  out.selection={h1:h1?h1.textContent.trim():null, sidebarOn:on?on.textContent.trim():null};
  out.selection.consistent=!h1||!document.getElementById('stage')||(!!on&&h1.textContent.includes(on.textContent.trim()));
  // orphan check: any visible CJK text block whose last line holds a single character
  const orph=[]; const els=[...document.querySelectorAll('#main *, #layer *, .navdrawer *')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&/[\u4e00-\u9fff]/.test(n.textContent))&&vis(e));
  for(const e of els){ const tn=[...e.childNodes].filter(n=>n.nodeType===3); const tops=[];
    for(const t of tn){for(let i=0;i<t.textContent.length;i++){const ch=t.textContent[i]; if(/\s/.test(ch))continue; const r=document.createRange(); r.setStart(t,i); r.setEnd(t,i+1); const b=r.getBoundingClientRect(); if(b.width) tops.push([Math.round(b.top),ch]);}}
    if(!tops.length) continue; const lines=[...new Set(tops.map(t=>t[0]))]; if(lines.length<2) continue;
    const last=tops.filter(t=>t[0]===lines[lines.length-1]).map(t=>t[1]).join('').replace(/[。，、．.,！？!?：:；;）)」』]/g,'');
    if(last.length===1&&![...e.children].some(x=>x.tagName!=='BR')) orph.push(e.textContent.trim().slice(0,30)+' → 「'+last+'」');}
  out.orphans=orph;
  return out;
};
