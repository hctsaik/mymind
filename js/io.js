// Import / export: Markdown outline, OPML, .mymind.json, PNG/SVG.
import { newId } from './store.js';
const withIds=n=>({id:newId(),t:n.t,...(n.note?{note:n.note}:{}),...(n.c&&n.c.length?{c:n.c.map(withIds)}:{})});
export function fromMarkdown(md){
  const lines=md.replace(/\r/g,'').split('\n').filter(l=>l.trim()); if(!lines.length) throw new Error('沒有內容');
  const items=[]; for(const l of lines){ let m;
    if(m=l.match(/^(#{1,6})\s+(.*)$/)) items.push({lv:m[1].length-1,t:m[2].trim(),h:true});
    else if(m=l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)) items.push({lv:null,ind:m[1].replace(/\t/g,'  ').length,t:m[3].trim()});
    else items.push({lv:null,ind:l.match(/^\s*/)[0].replace(/\t/g,'  ').length,t:l.trim()}); }
  const hMax=Math.max(-1,...items.filter(i=>i.h).map(i=>i.lv));
  const inds=[...new Set(items.filter(i=>!i.h).map(i=>i.ind))].sort((a,b)=>a-b);
  items.forEach(i=>{ if(!i.h) i.lv=hMax+1+inds.indexOf(i.ind); });
  let root; const stack=[];
  if(items[0].lv===0&&items.filter(i=>i.lv===0).length===1){root={t:items[0].t,c:[]};items.shift();} else root={t:'匯入的大綱',c:[]};
  stack.push({lv:-1,n:root}); const base=root.t==='匯入的大綱'?0:1;
  for(const it of items){ const lv=it.lv-base; const n={t:it.t.replace(/\*\*|__|`/g,''),c:[]};
    while(stack.length>1&&stack[stack.length-1].lv>=lv) stack.pop(); stack[stack.length-1].n.c.push(n); stack.push({lv,n}); }
  return withIds(root);
}
export function fromOPML(xml){ const d=new DOMParser().parseFromString(xml,'text/xml'); const body=d.querySelector('body'); if(!body) throw new Error('不是 OPML 檔');
  const conv=o=>({t:o.getAttribute('text')||o.getAttribute('title')||'',note:o.getAttribute('_note')||undefined,c:[...o.children].filter(x=>x.tagName==='outline').map(conv)});
  const tops=[...body.children].filter(x=>x.tagName==='outline'); const title=d.querySelector('head>title')?.textContent;
  return withIds(tops.length===1?conv(tops[0]):{t:title||'匯入的 OPML',c:tops.map(conv)}); }
export function toMarkdown(root){ const out=[`# ${root.t}`,'']; (function w(n,lv){(n.c||[]).forEach(c=>{out.push(`${'  '.repeat(lv)}- ${c.t.replace(/\n/g,' ')}`); if(c.note) out.push(`${'  '.repeat(lv+1)}> ${c.note.replace(/\n/g,' ')}`); w(c,lv+1);});})(root,0); return out.join('\n')+'\n'; }
export function toOPML(root){ const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const w=n=>`<outline text="${e(n.t)}"${n.note?` _note="${e(n.note)}"`:''}${n.c&&n.c.length?`>${n.c.map(w).join('')}</outline>`:'/>'}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>${e(root.t)}</title></head><body>${w(root)}</body></opml>\n`; }
export function download(name,data,type){ const b=data instanceof Blob?data:new Blob([data],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); }
export function svgString(svgInner,b,bg,pad=40){ const w=Math.ceil(b.w+pad*2),h=Math.ceil(b.h+pad*2);
  return {w,h,s:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${b.x0-pad} ${b.y0-pad} ${w} ${h}" font-family='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'><rect x="${b.x0-pad}" y="${b.y0-pad}" width="${w}" height="${h}" fill="${bg}"/>${svgInner}</svg>`}; }
export function toPNG(svg,w,h,scale=2){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=w*scale; c.height=h*scale; const x=c.getContext('2d'); x.scale(scale,scale); x.drawImage(img,0,0); c.toBlob(b=>b?res(b):rej(new Error('PNG 失敗')),'image/png'); }; img.onerror=()=>rej(new Error('PNG 失敗')); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); }); }
