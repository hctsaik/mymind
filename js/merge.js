// 3-way merge of two map trees by node id (base = last synced version). Field-level; when both sides change the
// same field of the same node, "mine" wins and the conflict is counted so the UI can say so.
import { pruneExtras } from './extras.js';
const FIELDS=['t','note','icon','pri','done','hl','tag','tags','color','link','img','collapsed'];
function flat(root){const m=new Map();(function w(n,p,i){m.set(n.id,{n,p,i});(n.c||[]).forEach((c,j)=>w(c,n.id,j));})(root,null,0);return m;}
// every node field except id/children takes part (v1.9: quick styles, 概要 sm, 外框 bd, imported classic looks…)
const pick=n=>{const o={};for(const f in n){ if(f!=='id'&&f!=='c'&&f!=='rels'&&n[f]!==undefined) o[f]=n[f]; }return o;};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function merge3(base,mine,theirs){
  const B=flat(base.root),M=flat(mine.root),T=flat(theirs.root); let conflicts=0;
  const allIds=new Set([...M.keys(),...T.keys()]); const out=new Map();
  for(const id of allIds){
    const b=B.get(id),m=M.get(id),t=T.get(id);
    if(!m&&!t) continue;
    if(b&&(!m||!t)){ // deleted on one side
      const other=m||t; const changed=!eq(pick(other.n),pick(b.n)); if(!changed) continue; // deletion wins over no-change
    }
    const src={}; const bf=b?pick(b.n):{}, mf=m?pick(m.n):{}, tf=t?pick(t.n):{};
    for(const f of new Set([...FIELDS,...Object.keys(bf),...Object.keys(mf),...Object.keys(tf)])){const mv=m?mf[f]:undefined,tv=t?tf[f]:undefined,bv=bf[f];
      let v; if(!m) v=tv; else if(!t) v=mv; else if(eq(mv,tv)) v=mv; else if(eq(mv,bv)) v=tv; else if(eq(tv,bv)) v=mv; else {v=mv;conflicts++;}
      if(v!==undefined) src[f]=v;}
    // parent/position: whichever side moved it
    let p,i; if(m&&t){const mMoved=!b||m.p!==b.p||m.i!==b.i, tMoved=b&&(t.p!==b.p||t.i!==b.i); [p,i]=(tMoved&&!mMoved)?[t.p,t.i]:[m.p,m.i];} else [p,i]=m?[m.p,m.i]:[t.p,t.i];
    out.set(id,{node:{id,...src,c:[]},p,i});
  }
  let root=null; const list=[...out.values()].sort((a,b)=>a.i-b.i);
  for(const e of list){ if(e.p===null){root=e.node;continue;} const par=out.get(e.p); (par?par.node:null)?.c.push(e.node); }
  // orphans (parent deleted on the other side) go under the root
  for(const e of list){ if(e.p!==null&&!out.get(e.p)) root.c.push(e.node); }
  (function clean(n){if(!n.c.length)delete n.c;else n.c.forEach(clean);})(root);
  // relationship lines (v1.5) live on the root: 3-way by id; a line deleted on one side and untouched on the other stays deleted
  const rb=new Map((base.root.rels||[]).map(r=>[r.id,r])), rm=new Map((mine.root.rels||[]).map(r=>[r.id,r])), rt=new Map((theirs.root.rels||[]).map(r=>[r.id,r])), rels=[];
  for(const id of new Set([...rm.keys(),...rt.keys()])){ const b=rb.get(id), m=rm.get(id), t=rt.get(id);
    if(b&&(!m||!t)){ const o=m||t; if(eq(o,b)) continue; } let v; if(m&&t){ v=eq(m,b)?t:eq(t,b)?m:m; if(!eq(m,t)&&!eq(m,b)&&!eq(t,b)) conflicts++; } else v=m||t; rels.push(v); }
  const ids=new Set(); (function w(n){ ids.add(n.id); (n.c||[]).forEach(w); })(root);
  const keep=rels.filter(r=>r&&ids.has(r.a)&&ids.has(r.b)&&r.a!==r.b); if(keep.length) root.rels=keep;
  pruneExtras(root); // 概要／外框 ranges whose ends were removed on the other side
  return {doc:{...mine,root,updated:new Date().toISOString()},conflicts};
}
export function diffSummary(a,b){const A=flat(a.root),Bm=flat(b.root);let add=0,del=0,mod=0;for(const [id,x] of Bm){const y=A.get(id);if(!y)add++;else if(!eq(pick(x.n),pick(y.n)))mod++;}for(const id of A.keys())if(!Bm.has(id))del++;return {add,del,mod};}
