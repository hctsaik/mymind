// Hidden focus debugger (v1.3.3). Open the app with ?debug=focus to see an on-screen log of focus / blur / resize /
// touch / mouse / IME events with their targets, so a screenshot shows what happened on a real phone.
// It never takes focus or taps (pointer-events:none, aria-hidden) and stores nothing.
export function install(version){
  if(document.getElementById('mmdebug')) return;
  const box=document.createElement('div'); box.id='mmdebug'; box.setAttribute('aria-hidden','true');
  Object.assign(box.style,{position:'fixed',left:'4px',right:'4px',top:'calc(60px + env(safe-area-inset-top))',maxHeight:'34vh',overflow:'hidden',zIndex:'2147483647',pointerEvents:'none',
    background:'rgba(17,17,17,.82)',color:'#fff',font:'11px/1.35 ui-monospace,Menlo,Consolas,monospace',padding:'6px 8px',borderRadius:'8px',whiteSpace:'pre-wrap',wordBreak:'break-all'});
  document.body.appendChild(box);
  const t0=performance.now(), lines=[];
  const head=()=>`MyMind ${version} · debug=focus · ${innerWidth}×${innerHeight}${window.visualViewport?' vv '+Math.round(visualViewport.height):''} · ${(navigator.userAgent.match(/Android [\d.]+|iPhone OS [\d_]+|Chrome\/\d+|Version\/[\d.]+/g)||[]).join(' ')}`;
  const desc=el=>{ if(!el) return 'none'; if(el===document) return 'document'; if(el===window) return 'window'; if(!el.tagName) return String(el.nodeName||el);
    let s=el.tagName.toLowerCase(); if(el.id) s+='#'+el.id; const c=typeof el.className==='string'?el.className.trim().split(/\s+/).filter(Boolean).slice(0,2).join('.'):''; if(c) s+='.'+c; if(el.dataset&&el.dataset.act) s+='['+el.dataset.act+']';
    const g=el.closest&&el.closest('g.node'); if(g&&g!==el) s+=' (node '+g.dataset.id+')'; return s; };
  const log=m=>{ lines.push(((performance.now()-t0)/1000).toFixed(2)+' '+m); if(lines.length>36) lines.shift(); box.textContent=head()+'\n'+lines.slice(-22).join('\n'); };
  window.__mmDbg=log;
  const on=(tgt,t,f)=>tgt.addEventListener(t,f,{capture:true,passive:true});
  on(document,'focusin',e=>log('focusin  '+desc(e.target)+' ← '+desc(e.relatedTarget)));
  on(document,'focusout',e=>log('focusout '+desc(e.target)+' → '+desc(e.relatedTarget)));
  for(const t of ['pointerdown','pointerup','pointercancel']) on(document,t,e=>log(t+' '+e.pointerType+' '+desc(e.target)+(e.defaultPrevented?' (prevented)':'')));
  for(const t of ['touchstart','touchend','touchcancel','mousedown','click']) on(document,t,e=>log(t+' '+desc(e.target)));
  for(const t of ['compositionstart','compositionend']) on(document,t,e=>log(t+' '+desc(e.target)+(e.data?' "'+e.data+'"':'')));
  on(document,'keydown',e=>log('keydown key='+e.key+' code='+e.keyCode+(e.isComposing?' composing':'')+' '+desc(e.target)));
  on(window,'resize',()=>log('resize window '+innerWidth+'×'+innerHeight));
  if(window.visualViewport){ on(visualViewport,'resize',()=>log('resize visualViewport '+Math.round(visualViewport.width)+'×'+Math.round(visualViewport.height)+' top '+Math.round(visualViewport.offsetTop))); }
  on(document,'visibilitychange',()=>log('visibility '+document.visibilityState));
  on(window,'blur',()=>log('window blur')); on(window,'focus',()=>log('window focus'));
  // catch elements that are removed while focused (the classic "keyboard opens then closes")
  new MutationObserver(ms=>{ for(const m of ms) for(const n of m.removedNodes){ if(n.nodeType===1&&(n.classList&&n.classList.contains('editbox')||n.querySelector&&n.querySelector('.editbox'))) log('REMOVED editor element ('+desc(n)+')'); } }).observe(document.body,{childList:true,subtree:true});
  log('active: '+desc(document.activeElement));
}
