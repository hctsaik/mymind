// Import / export: Markdown outline, OPML, .mymind.json, PNG/SVG.
import { newId } from './store.js';
const withIds=n=>({id:newId(),t:n.t,...(n.note?{note:n.note}:{}),...(n.c&&n.c.length?{c:n.c.map(withIds)}:{})});
// ---------- Markdown ----------
// Inline markdown → plain node text. Links keep their text; URLs are returned so the caller can keep them (in the note).
export function stripInline(t){ const links=[];
  t=String(t).replace(/\\([\\`*_{}\[\]()#+\-.!>|~<])/g,(m,c)=>'\u0000'+c.charCodeAt(0)+'\u0001').replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,(m,a,u)=>{links.push(u);return a;})
     .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,(m,a,u)=>{links.push(u);return a;})
     .replace(/<(https?:\/\/[^>\s]+)>/g,(m,u)=>u)
     .replace(/`([^`]+)`/g,'$1').replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g,'$2').replace(/~~(?=\S)(.+?)(?<=\S)~~/g,'$1')
     .replace(/(^|[^\w*])\*(?=\S)([^*]+?)(?<=\S)\*(?!\w)/g,'$1$2').replace(/(^|[^\w])_(?=\S)([^_]+?)(?<=\S)_(?!\w)/g,'$1$2')
     .replace(/<\/?[a-zA-Z][^>]*>/g,'').replace(/\u0000(\d+)\u0001/g,(m,c)=>String.fromCharCode(+c)).replace(/\s+/g,' ').trim();
  return {t,links}; }
// Markdown → list of top-level nodes (no ids). Headings, - * + 1. 1) lists, [ ]/[x] tasks, indented plain lines,
// "> " quotes (become the previous node's note), fenced code (kept as plain lines), --- rules and blank lines ignored.
export function parseMarkdown(md,{links:linkMode='field'}={}){
  const src=String(md||'').replace(/\r\n?/g,'\n').replace(/^\uFEFF/,'').split('\n');
  const tops=[]; const stack=[]; // {lv,n}
  let head=-1, listInd=[], inFence=false, last=null;
  const push=(lv,n)=>{ while(stack.length&&stack[stack.length-1].lv>=lv) stack.pop(); (stack.length?(stack[stack.length-1].n.c=stack[stack.length-1].n.c||[]):tops).push(n); stack.push({lv,n}); last=n; };
  const mk=(raw,extra={})=>{ raw=raw.replace(/^\\(?=#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\[[ xX]\]\s)/,''); const n0={}; const litEm=/^\\\p{Extended_Pictographic}/u.test(raw); if(litEm) raw=raw.slice(1);
    const em=!litEm&&raw.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?)*)\s+(\S.*)$/u); if(em){ n0.icon=em[1]; raw=em[2]; }
    const tags=[]; let tm; while((tm=raw.match(/\s#([\p{L}\p{N}_\-\/]{1,24})\s*$/u))&&!/^\d+$/.test(tm[1])){ tags.unshift(tm[1]); raw=raw.slice(0,tm.index); } if(tags.length) n0.tags=tags;
    const {t,links}=stripInline(raw); const n={t:t||'（空白）',...n0,...extra};
    if(links.length){ const http=links.filter(u=>/^https?:\/\//i.test(u)); if(linkMode==='field'&&http.length){ n.link=http[0]; const rest=links.filter(u=>u!==http[0]); if(rest.length) n.note=rest.map(u=>'連結：'+u).join('\n'); } else n.note=links.map(u=>'連結：'+u).join('\n'); }
    return n; };
  for(const line0 of src){ const line=line0.replace(/\t/g,'    ');
    if(/^\s*(```|~~~)/.test(line)){ inFence=!inFence; continue; }
    if(!line.trim()) continue;
    { const im=!inFence&&line.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+|data:image\/[^)\s]+)\)$/); if(im&&last&&!last.img){ last.img={src:im[2],...(im[1]?{alt:im[1]}:{})}; continue; } }
    if(!inFence&&/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) continue; // horizontal rule
    let m;
    if(!inFence&&(m=line.match(/^\s*>\s?(.*)$/))){ if(last){ const q=stripInline(m[1]).t; if(q) last.note=(last.note?last.note+'\n':'')+q; } else push(head+1,mk(m[1])); continue; }
    if(!inFence&&(m=line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/))){ const lv=m[1].length-1; head=lv; listInd=[]; push(lv,mk(m[2])); continue; }
    const ind=line.match(/^\s*/)[0].length; let text=line.trim(), extra={};
    if(!inFence&&(m=text.match(/^([-*+]|\d{1,9}[.)])\s+(.*)$/))){ text=m[2]; const tk=text.match(/^\[([ xX])\]\s+(.*)$/); if(tk){ text=tk[2]; if(tk[1]!==' ') extra.done=true; } }
    else if(!inFence&&(m=text.match(/^([-*+]|\d{1,9}[.)])$/))) continue; // empty bullet
    while(listInd.length&&listInd[listInd.length-1]>ind) listInd.pop();
    if(!listInd.length||listInd[listInd.length-1]<ind) listInd.push(ind);
    push(head+listInd.length,mk(text,extra)); }
  return tops; }
const withIdsDeep=n=>({...n,id:newId(),...(n.c&&n.c.length?{c:n.c.map(withIdsDeep)}:{})});
// Markdown → a whole map: root = the single top item, or the first H1 / first line with everything else under it.
export function fromMarkdown(md,o){ const tops=parseMarkdown(md,o); if(!tops.length) throw new Error('沒有內容');
  let root; if(tops.length===1) root=tops[0];
  else { root={...tops[0],c:[...(tops[0].c||[]),...tops.slice(1)]}; }
  return withIdsDeep(root); }
// Markdown → nodes to insert under a node: one top item = one child subtree; many = siblings.
export const nodesFromMarkdown=(md,o)=>parseMarkdown(md,o).map(withIdsDeep);
const escInline=t=>stripInline(t).t===t?t:t.replace(/[\\`*_\[\]~<>]/g,'\\$&');
const escLine=t=>escInline(String(t||'').replace(/\s+/g,' ').trim()).replace(/(\s)#(?=[\p{L}\p{N}_\-\/]{1,24}\s*$)/u,'$1\\#').replace(/^(\p{Extended_Pictographic})/u,'\\$1').replace(/^(\s*)(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\[[ xX]\]\s)/,'$1\\$2');
const noteLines=(note,ind)=>String(note).split('\n').filter(x=>x.trim()).map(x=>`${ind}> ${x.trim()}`);
const tagsOfN=n=>Array.isArray(n.tags)?n.tags:(n.tag?[n.tag]:[]);
// one node → its Markdown line: "icon [text](link) #tag #tag"
function lineOf(n){ const txt=escLine(n.t); const body=n.link?`[${txt.replace(/\]/g,'\\]')}](${String(n.link).replace(/[()\s]/g,c=>encodeURIComponent(c))})`:txt; return `${n.icon?n.icon+' ':''}${body}${tagsOfN(n).map(t=>' #'+t).join('')}`; }
// image (web address only; images pasted into the map are too big for Markdown) + note lines under a node
let OUT=null; function extras(n,ind){ if(n.img&&/^https?:/i.test(n.img.src)) OUT.push(`${ind}![${(n.img.alt||'').replace(/[\[\]]/g,'')}](${n.img.src})`); if(n.note) OUT.push(...noteLines(n.note,ind)); }
// Map/subtree → Markdown. Root: "# title"; descendants: nested "- " lists (2 spaces), done → "- [x]", notes → "> " lines.
export function toMarkdown(node,{asRoot=true}={}){ const out=[]; OUT=out;
  const item=(c,lv)=>{ out.push(`${'  '.repeat(lv)}- ${c.done?'[x] ':''}${lineOf(c)}`); extras(c,'  '.repeat(lv+1)); (c.c||[]).forEach(k=>item(k,lv+1)); };
  if(asRoot){ out.push(`# ${lineOf(node)}`); extras(node,''); out.push(''); (node.c||[]).forEach(c=>item(c,0)); }
  else item(node,0);
  return out.join('\n')+'\n'; }
// Subtree → simple HTML list (for pasting into docs), carrying the exact MyMind JSON for lossless paste back.
export function toClipboardHTML(node,asRoot){ const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const li=n=>`<li>${e(n.t)}${n.c&&n.c.length?`<ul>${n.c.map(li).join('')}</ul>`:''}</li>`;
  const data=btoa(unescape(encodeURIComponent(JSON.stringify({format:'mymind-nodes/1',nodes:[node]}))));
  return `<div data-mymind="${data}">${asRoot?`<h1>${e(node.t)}</h1><ul>${(node.c||[]).map(li).join('')}</ul>`:`<ul>${li(node)}</ul>`}</div>`; }
export function fromClipboardHTML(html){ const m=/data-mymind="([A-Za-z0-9+/=]+)"/.exec(html||''); if(!m) return null;
  try{ const d=JSON.parse(decodeURIComponent(escape(atob(m[1])))); return d.format==='mymind-nodes/1'&&Array.isArray(d.nodes)?d.nodes:null; }catch{ return null; } }
export function fromOPML(xml){ const d=new DOMParser().parseFromString(xml,'text/xml'); const body=d.querySelector('body'); if(!body) throw new Error('不是 OPML 檔');
  const conv=o=>({t:o.getAttribute('text')||o.getAttribute('title')||'',note:o.getAttribute('_note')||undefined,c:[...o.children].filter(x=>x.tagName==='outline').map(conv)});
  const tops=[...body.children].filter(x=>x.tagName==='outline'); const title=d.querySelector('head>title')?.textContent;
  return withIds(tops.length===1?conv(tops[0]):{t:title||'匯入的 OPML',c:tops.map(conv)}); }
export function toOPML(root){ const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const w=n=>`<outline text="${e(n.t)}"${n.note?` _note="${e(n.note)}"`:''}${n.c&&n.c.length?`>${n.c.map(w).join('')}</outline>`:'/>'}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>${e(root.t)}</title></head><body>${w(root)}</body></opml>\n`; }
export function download(name,data,type){ const b=data instanceof Blob?data:new Blob([data],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); }
export function svgString(svgInner,b,bg,pad=40){ const w=Math.ceil(b.w+pad*2),h=Math.ceil(b.h+pad*2);
  return {w,h,s:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${b.x0-pad} ${b.y0-pad} ${w} ${h}" font-family='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'><rect x="${b.x0-pad}" y="${b.y0-pad}" width="${w}" height="${h}" fill="${bg}"/>${svgInner}</svg>`}; }
export function toPNG(svg,w,h,scale=2){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=w*scale; c.height=h*scale; const x=c.getContext('2d'); x.scale(scale,scale); x.drawImage(img,0,0); c.toBlob(b=>b?res(b):rej(new Error('PNG 失敗')),'image/png'); }; img.onerror=()=>rej(new Error('PNG 失敗')); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); }); }

// ---------- PDF (v1.3): one A4 page, map fitted, rendered image embedded losslessly (FlateDecode) ----------
const enc=new TextEncoder();
function pdfText(s){ // UTF-16BE hex string with BOM, safe for any title
  let h='FEFF'; for(const ch of String(s)){ const cp=ch.codePointAt(0); if(cp>0xFFFF){ const v=cp-0x10000; h+=(0xD800+(v>>10)).toString(16).padStart(4,'0')+(0xDC00+(v&0x3FF)).toString(16).padStart(4,'0'); } else h+=cp.toString(16).padStart(4,'0'); } return '<'+h.toUpperCase()+'>'; }
async function deflate(bytes){ if(typeof CompressionStream==='undefined') return null; const cs=new CompressionStream('deflate'); const out=new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer(); return new Uint8Array(await out); }
function hexRGB(c){ const m=/^#?([0-9a-f]{6})$/i.exec(c||''); const v=m?parseInt(m[1],16):0xFFFFFF; return [(v>>16)/255,((v>>8)&255)/255,(v&255)/255].map(x=>x.toFixed(3)).join(' '); }
export async function toPDF(svg,w,h,{title='MyMind',bg='#FFFFFF',maxPx=4096}={}){
  const land=w>h, PW=land?841.89:595.28, PH=land?595.28:841.89, M=28;
  const fit=Math.min((PW-2*M)/w,(PH-2*M)/h), dw=w*fit, dh=h*fit;
  const scale=Math.max(1,Math.min(3,maxPx/Math.max(w,h),(dw/72*200)/w)); // ~200 dpi on paper, capped
  const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('PDF 失敗')); i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); });
  const c=document.createElement('canvas'); c.width=Math.round(w*scale); c.height=Math.round(h*scale); const x=c.getContext('2d'); x.fillStyle=bg; x.fillRect(0,0,c.width,c.height); x.scale(scale,scale); x.drawImage(img,0,0);
  let data,filter; const raw=x.getImageData(0,0,c.width,c.height).data; const rgb=new Uint8Array(c.width*c.height*3); for(let i=0,j=0;i<raw.length;i+=4){ rgb[j++]=raw[i]; rgb[j++]=raw[i+1]; rgb[j++]=raw[i+2]; }
  const z=await deflate(rgb); if(z){ data=z; filter='/FlateDecode'; } else { data=new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/jpeg',.92))).arrayBuffer()); filter='/DCTDecode'; }
  const ox=(PW-dw)/2, oy=(PH-dh)/2;
  const content=`q ${hexRGB(bg)} rg 0 0 ${PW} ${PH} re f Q\nq ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${ox.toFixed(2)} ${oy.toFixed(2)} cm /Im0 Do Q\n`;
  const objs=[`<< /Type /Catalog /Pages 2 0 R >>`,`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
    [`<< /Length ${enc.encode(content).length} >>\nstream\n`,enc.encode(content),`\nendstream`],
    [`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${data.length} >>\nstream\n`,data,`\nendstream`],
    `<< /Title ${pdfText(title)} /Producer (MyMind) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}Z) >>`];
  const parts=[enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]; let off=parts[0].length; const xref=[];
  objs.forEach((o,i)=>{ xref.push(off); const seg=[`${i+1} 0 obj\n`,...(Array.isArray(o)?o:[o]),`\nendobj\n`].map(p=>typeof p==='string'?enc.encode(p):p); seg.forEach(p=>{parts.push(p); off+=p.length;}); });
  const xs=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n${xref.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objs.length+1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  parts.push(enc.encode(xs)); return new Blob(parts,{type:'application/pdf'}); }
