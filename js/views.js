// HTML templates. Every function returns a string; app.js owns state and events (data-act attributes).
import { I, esc, THEMES, DEFAULT_THEME, PRI, readable } from './core.js';
import { thumbSvg, themeThumb, LAYOUTS, tagsOf, marks } from './mapview.js';
import { VERSION } from './version.js';
export const isMobile=()=>innerWidth<=768;
const LOGO=`<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.6" fill="#fff" stroke="none"/><path d="M8.6 12H11M11 6.5V17.5M11 6.5H19M11 12H19M11 17.5H19"/></svg>`;
export function rel(iso){ if(!iso) return ''; const d=new Date(iso), s=(Date.now()-d)/1000;
  if(s<60) return '剛剛'; if(s<3600) return Math.floor(s/60)+' 分鐘前'; if(s<86400&&new Date().getDate()===d.getDate()) return '今天 '+d.toTimeString().slice(0,5);
  if(s<172800) return '昨天 '+d.toTimeString().slice(0,5); return `${d.getMonth()+1}/${d.getDate()}`; }
const MODE_NAME={local:'只存瀏覽器',manual:'手動同步',auto:'自動同步'};
const where=S=>S.backend==='drive'?`Google 雲端硬碟 · ${esc(S.driveEmail)}`:`GitHub · ${esc(S.repo)}`;
const syncLine=(S)=>S.remote?`<b><span class="g" aria-hidden="true" style="${S.sync.state==='error'?'background:var(--danger)':S.sync.state==='offline'||S.driveAuth?'background:var(--warn-line)':''}"></span>${S.sync.state==='offline'?'離線（稍後同步）':S.driveAuth?'需要重新連結':S.sync.state==='error'?'同步失敗':MODE_NAME[S.syncMode]}</b><span class="repo">${where(S)}</span>`:`<b>只存在這個瀏覽器</b><button class="linkbtn" data-act="settings" data-v="data">備份或連接雲端（選用）</button>`;
// 同步 button: visible whenever GitHub sync is on; the badge counts maps (and deletions) not yet on GitHub
export function syncBtn(S,k='top'){ if(!S.remote) return `<span class="syncbtn" data-k="${k}" hidden></span>`; const n=S.unsynced, busy=S.sync.state==='saving';
  if(S.driveAuth){ const l=`重新連結 Google 才能同步${n?`（${n} 項未同步）`:''}`; const bd=n?`<span class="nbadge" aria-hidden="true">${n>99?'99+':n}</span>`:'';
    return k==='side'?`<button class="btn syncbtn side-sync has reauth" data-k="side" data-act="syncNow" aria-label="${l}">${I('alert')}<span>重新連結 Google</span>${bd}</button>`:`<button class="btn syncbtn has reauth" data-k="${k}" data-act="syncNow" aria-label="${l}" title="${l}">${I('alert')}<span class="lbl">重新連結</span>${bd}</button>`; }
  const lbl=busy?'同步中…':n?`同步（${n} 項未同步）`:'已同步，再同步一次';
  const badge=n?`<span class="nbadge" aria-hidden="true">${n>99?'99+':n}</span>`:'';
  if(k==='side') return `<button class="btn syncbtn side-sync ${n?'has':''}" data-k="side" data-act="syncNow" aria-label="${lbl}"${busy?' aria-busy="true"':''}>${I('cloud')}<span>${busy?'同步中…':n?(S.backend==='drive'?'同步到雲端硬碟':'同步到 GitHub'):'已同步'}</span>${badge}</button>`;
  return `<button class="btn syncbtn ${n?'has':''}" data-k="${k}" data-act="syncNow" aria-label="${lbl}" title="${lbl}（Ctrl+S）"${busy?' aria-busy="true"':''}>${I('cloud')}<span class="lbl">${busy?'同步中…':'同步'}</span>${badge}</button>`; }
export function sidebar(S,list){
  const cnt=k=>list.filter(m=>k==='all'?!m.trashed:k==='starred'?m.star&&!m.trashed:k==='trash'?m.trashed:!m.trashed).length;
  const files=list.filter(m=>!m.trashed&&(!S.sideQ||(m.title||'').toLowerCase().includes(S.sideQ.toLowerCase()))).sort((a,b)=>(b.updated||'').localeCompare(a.updated||''));
  return `<div class="brand"><div class="logo" aria-hidden="true">${LOGO}</div><b>MyMind</b></div>
  <button class="new-btn" data-act="new">${I('plus')}新增心智圖</button>
  <label class="search">${I('search')}<span class="sr">搜尋標題</span><input id="sideq" data-input="sideQ" value="${esc(S.sideQ||'')}" placeholder="搜尋標題…" autocomplete="off"><span class="kbd desk-only">/</span></label>
  <nav class="nav" aria-label="分類">${[['all','home','所有心智圖'],['starred','star','已加星號'],['recent','clock','最近開啟'],['trash','trash','垃圾桶']].map(([k,ic,n])=>`<a href="#/${k==='all'?'':k}" class="${S.view==='list'&&S.filter===k?'on':''}"${S.view==='list'&&S.filter===k?' aria-current="page"':''}>${I(ic)}${n}${k!=='recent'?`<span class="cnt">${cnt(k)}</span>`:''}</a>`).join('')}</nav>
  <div class="sec"><span id="mylbl">我的心智圖</span><button class="icon-btn sec-add" data-act="new" aria-label="新增心智圖">${I('plus')}</button></div>
  <div class="files" role="list" aria-labelledby="mylbl">${files.length?files.map(m=>{const on=S.view==='editor'&&S.mapId===m.id;return `<a role="listitem" href="#/map/${m.id}" class="file ${on?'on':''}"${on?' aria-current="page"':''}><div class="fi" style="background:${esc(THEMES[m.theme||DEFAULT_THEME].canvas==='#FFFFFF'?'#FFF1E6':THEMES[m.theme||DEFAULT_THEME].canvas)}" aria-hidden="true">${esc(m.icon||'🧠')}</div><div style="min-width:0;flex:1"><div class="ft">${esc(m.title||'未命名')}</div><div class="fm">${rel(m.updated)}${m.dirty&&S.remote?'<span class="badge">未同步</span>':''}</div></div></a>`;}).join(''):`<div class="fm" style="padding:10px 14px">${S.sideQ?'找不到「'+esc(S.sideQ)+'」':'還沒有心智圖'}</div>`}</div>
  ${S.remote?`<div class="side-syncrow">${syncBtn(S,'side')}</div>`:''}<div class="side-foot"><div class="sync">${syncLine(S)}</div><button class="icon-btn" style="margin-left:auto" data-act="settings" aria-label="設定">${I('gear')}</button></div>`;
}
export function savedChip(S){ const s=S.sync; let ic='cloud',l,sh;
  if(!S.remote){l='已存在這個瀏覽器';sh='已存本機';}
  else if(s.state==='saving'){l='同步中…';sh='同步中';}
  else if(s.state==='offline'){ic='alert';l='離線：已存本機，恢復連線後再同步';sh='離線';}
  else if(S.driveAuth){ic='alert';l='已存本機 · 需要重新連結 Google 才能同步';sh='待連結';}
  else if(s.state==='error'){ic='alert';l='同步失敗：'+(s.msg||'');sh='失敗';}
  else if(S.unsynced){l=`已存本機 · ${S.unsynced} 項未同步`+(S.syncMode==='auto'&&S.autoAt?` · 約 ${Math.max(1,Math.round((S.autoAt-Date.now())/60000))} 分鐘內自動同步`:S.syncMode==='manual'?' · 按「同步」上傳':'');sh='未同步';}
  else {l='已同步到 '+(S.backendName||'GitHub')+(s.at?' · '+rel(s.at):'');sh='已同步';}
  return `<span class="saved ${s.state==='error'?'err':''}" role="status" aria-live="polite">${I(ic)}<span class="long">${esc(l)}</span><span class="short">${esc(sh)}</span></span>`;}
export function topbar(S,doc,curNode){
  const tb=[['undo','復原','low','Ctrl+Z','undo'],['redo','重做','low','Ctrl+Y','redo'],'|low',['child','子主題','','Tab','addChild'],['sibling','同級','','Enter','addSibling'],['parent','升一層','low','Shift+Tab','outdent'],'|',['smile','圖示','','Alt+I','icons'],['note','詳情','','Ctrl+Alt+M','note'],'|',['search','搜尋','','Ctrl+F','find'],'|',['spark','AI 展開','ai','Ctrl+J','aiExpand'],['wand','換主題','low','F6','randomTheme'],['outline','大綱',S.outline?'on':'','Ctrl+O','outline'],['history','歷史',(S.panel==='history'?'on ':'')+'low','Shift+Alt+H','history']];
  return `<header class="top flt">
   <button class="icon-btn mobile-only rb backpill" data-act="home" aria-label="回到列表（目前節點：${esc(curNode)}）">${I('back')}<span class="cn">${esc(curNode)}</span></button>
   <div class="title"><h1 id="maptitle">${esc(doc.icon||'🧠')} ${esc(doc.root.t)}</h1>${savedChip(S)}</div>
   <div class="tb" role="toolbar" aria-label="編輯工具">${tb.map(b=>typeof b==='string'?`<span class="sep ${b.slice(1)}"></span>`:`<button class="tbtn ${b[2]}" data-act="${b[4]}" aria-label="${b[1]}${b[3]?'（'+b[3]+'）':''}" title="${b[1]}${b[3]?'  '+b[3]:''}"${b[4]==='outline'?` aria-pressed="${!!S.outline}"`:b[4]==='history'?` aria-pressed="${S.panel==='history'}"`:''}>${I(b[0])}<span>${b[1]}</span></button>`).join('')}</div>
   <div class="right-actions">
     ${syncBtn(S,'top')}
     <button class="btn ghost exp desk-only" data-act="exportMenu" aria-haspopup="menu" aria-expanded="false" aria-label="匯出">${I('download')}<span class="lbl">匯出</span></button>
     <button class="btn desk-only ${S.panel==='style'?'style-on':''}" data-act="style" aria-pressed="${S.panel==='style'}">${I('palette')}樣式</button>
     <button class="icon-btn mobile-only rb ai" data-act="ai" aria-label="AI">${I('spark')}</button>
     <button class="icon-btn mobile-only rb" data-act="style" aria-label="美化：主題與樣式">${I('wand')}</button>
     <button class="icon-btn mobile-only rb" data-act="find" aria-label="搜尋節點" aria-pressed="${!!S.find}">${I('search')}</button>
     <button class="icon-btn mobile-only rb" data-act="outline" aria-label="大綱" aria-pressed="${!!S.outline}">${I('outline')}</button>
     <button class="icon-btn mobile-only rb" data-act="moreMenu" aria-haspopup="menu" aria-expanded="false" aria-label="更多：層級、縮放、匯出、歷史、設定">${I('more')}</button>
   </div></header>`;
}
export function editorShell(S,doc,curNode){ const th=THEMES[doc.theme]||THEMES[DEFAULT_THEME], m=isMobile(), sheet=m&&S.panel;
  return `${topbar(S,doc,curNode)}<div class="canvas ${S.panel&&!m?'has-panel':''} ${S.outline?'outline-on':''} ${sheet?'sheet-open':''}" id="cv" tabindex="0" role="application" aria-roledescription="心智圖畫布" aria-label="心智圖：${esc(doc.root.t)}。Tab 新增子主題，Enter 新增同級，Space 編輯，Esc 離開畫布" style="--cv:${th.canvas};--cvdot:${th.canvas}">
     <div class="stage" id="stage"><svg class="map" id="mapsvg" role="tree" aria-label="節點"><g id="vp"></g></svg><div id="ovl"></div></div>
     ${S.find?findbar(S):''}<div id="outlineHost"></div>
     <div class="cbar"><div class="levels" data-dock="${m?'right':'bottom'}" role="group" aria-label="展開到第幾層"><span>層級</span>${[1,2,3,0].map(l=>`<button data-act="level" data-v="${l}" aria-label="${l?'展開到第 '+l+' 層':'全部展開'}">${l||'全部'}</button>`).join('')}</div>${S.preview?`<span class="pvchip" role="status" data-dock="bottom">${I('history')}預覽 ${esc(S.preview.label)} · 唯讀</span>`:''}${S.hints&&!m?`<div class="hint" data-dock="bottom" aria-hidden="true"><span><span class="kbd">Tab</span>子主題</span><span><span class="kbd">Enter</span>同級</span><span><span class="kbd">Space</span>編輯</span><span><span class="kbd">Del</span>刪除</span><span><span class="kbd">Esc</span>離開畫布</span></div>`:''}</div>
     <div class="zoom ${S.minimap&&!m?'mini-on':''}" data-dock="${S.minimap||m?'right':'bottom'}"><div class="minimap" aria-label="小地圖"><svg id="mmsvg" aria-hidden="true"></svg><div class="vp" id="mmvp"></div></div>
       <div class="zctl"><button class="icon-btn" data-act="zoomOut" aria-label="縮小">${I('minus')}</button><span class="pct" id="pct">100%</span><button class="icon-btn" data-act="zoomIn" aria-label="放大">${I('plus')}</button><span class="zsep"></span><button class="icon-btn" data-act="fit" aria-label="符合畫面">${I('fit')}</button><button class="icon-btn mm-t" data-act="minimap" aria-pressed="${!!S.minimap}" aria-label="小地圖">${I('mini')}</button><button class="icon-btn kb" data-act="shortcuts" aria-label="鍵盤快捷鍵（?）">${I('kb')}</button></div></div>
     <div id="panelHost"></div>
     ${m&&S.aibar&&!S.outline?`<form class="aibar" data-dock="bottom" id="aibar" aria-label="AI 指令"><label class="sr" for="aiq">請輸入你的需求</label><input id="aiq" placeholder="請輸入你的需求" autocomplete="off" enterkeyhint="send"><button type="button" class="x" data-act="aibarClose" aria-label="收起 AI 指令列">${I('x')}</button><button type="submit" class="send" aria-label="送出" disabled>${I('up')}</button></form>`:''}
     </div>`;
}
let togN=0;
const tog=(lbl,on,act)=>{const id='tg'+(togN++);return `<div class="row"><span id="${id}">${lbl}</span><button class="toggle" role="switch" data-act="${act}" aria-checked="${!!on}" aria-labelledby="${id}"><i></i></button></div>`};
const seg=(label,act,opts,val)=>`<div class="row"><span id="sg-${act}">${label}</span><div class="seg" role="group" aria-labelledby="sg-${act}">${opts.map(([v,n])=>`<button data-act="${act}" data-v="${v}" aria-pressed="${String(val)===String(v)}">${n}</button>`).join('')}</div></div>`;
export function stylePanel(S,doc,node){ const tab=S.tab, set=doc.settings||{}, th=THEMES[doc.theme]||THEMES[DEFAULT_THEME];
  const tabs=[['theme','主題'],['node','節點'],['layout','版面'],['canvas','畫布']];
  const panels={
   theme:`<div class="plabel"><span>主題配色（整張圖）</span><button class="linkbtn" data-act="randomTheme">${I('wand')}隨機換一個<span class="desk-only">&nbsp;· F6</span></button></div>
    <div class="themes">${Object.keys(THEMES).map(k=>`<button class="theme" data-act="theme" data-v="${k}" aria-pressed="${k===doc.theme}">${themeThumb(THEMES[k])}<span>${THEMES[k].name}${k===DEFAULT_THEME?'（預設）':''}</span></button>`).join('')}</div>
    <p class="panel-note">主題只改這張圖的配色；介面淺色／深色和「淺色線條」在 設定 › 外觀與無障礙。</p>`,
   node:node?`<div class="plabel"><span>選取：${esc(node.t)}</span></div>
    <div class="row"><span>螢光標記</span><div class="swatches">${['none','#FFE27A','#FFD1DC','#C8F0D8','#CFE3FF'].map(c=>`<button class="sw" data-act="hl" data-v="${c}" aria-label="${c==='none'?'無標記':'標記 '+c}" aria-pressed="${c==='none'?!node.hl:node.hl===c}"><i style="background:${c==='none'?'repeating-linear-gradient(45deg,#fff 0 4px,#D5D9DF 4px 8px)':c};border-radius:4px"></i></button>`).join('')}</div></div>
    ${tog('完成勾選',node.done,'done')}
    <div class="plabel"><span>優先順序</span><span class="kbd desk-only">Ctrl+1…5</span></div>
    <div class="pri">${[1,2,3,4,5].map(n=>`<button data-act="pri" data-v="${n}" aria-pressed="${node.pri===n}" aria-label="優先順序 ${n}"><i style="background:${PRI[n]}">${n}</i></button>`).join('')}<button data-act="pri" data-v="0" aria-label="清除優先順序" aria-pressed="${!node.pri}"><i style="background:var(--panel-2);color:var(--text)">×</i></button></div>
    <div class="plabel"><span>圖示</span><span class="kbd desk-only">Alt+I</span></div>
    <div class="emoji-grid" id="icongrid">${'⭐️✅❗️❓💡📌🔥🎯📅🏨✈️💰🧳🍜📝👍❌⚡'.match(/\p{Extended_Pictographic}\uFE0F?/gu).map(e=>`<button data-act="icon" data-v="${e}" aria-label="圖示 ${e}" aria-pressed="${node.icon===e}">${e}</button>`).join('')}<button data-act="icon" data-v="" aria-label="移除圖示">∅</button></div>
    <div class="row" style="margin-top:12px"><button class="btn" data-act="note">${I('note')}${node.note?'編輯備註':'新增備註'}</button></div>`:`<p class="panel-note">先在地圖上點一個節點。</p>`,
   layout:`<div class="plabel"><span>版面配置（存在這張圖）</span></div>
    <div class="layouts" role="radiogroup" aria-label="版面配置">${LAYOUTS.map(([k,n])=>`<button class="lyt" role="radio" data-act="layout" data-v="${k}" aria-checked="${(set.layout||'right')===k}">${layoutThumb(k)}<span>${n}</span></button>`).join('')}</div>
    <button class="btn olbtn" data-act="outline">${I('outline')}切換到大綱（可編輯清單）<span class="kbd desk-only">Ctrl+O</span></button>
    <div class="plabel"><span>分支線條（整張圖）</span></div>
    ${seg('連線樣式','edge',[['bracket','括號折線'],['curve','曲線'],['straight','直線']],set.edge||th.edge||'curve')}
    ${seg('線條粗細','lw',[['thin','細'],['standard','標準'],['thick','粗']],set.lw||'standard')}
    <div class="plabel"><span>間距</span></div>
    ${(set.layout||'right')==='right'?seg('根節點位置','rootTop',[['0','置中'],['1','靠上']],set.rootTop??th.rootTop?1:0):''}
    ${seg('層與層','spacing',[['compact','緊湊'],['standard','標準'],['loose','寬鬆']],set.spacing||'standard')}
    <p class="panel-note">${(set.layout||'right')==='org'?'組織圖使用固定的折線，連線樣式只影響其他版面。':'版面只改變排列方式，內容和順序不變；匯出 PNG／SVG／PDF 也會用這個版面。'}</p>`,
   canvas:`<div class="plabel"><span>畫布</span></div>${tog('顯示小地圖',S.minimap,'minimap')}${tog('快捷鍵提示',S.hints,'hints')}`};
  return `<section class="stylep" data-dock="${isMobile()?'bottom':'right'}" aria-label="樣式面板">
   ${isMobile()?'<div class="grab" aria-hidden="true"></div>':''}
   <div class="phead"><h3>樣式</h3><span class="kbd desk-only" style="margin-left:6px">Alt+Y</span><button class="icon-btn" style="margin-left:auto" data-act="closePanel" aria-label="關閉樣式面板">${I('x')}</button></div>
   <div class="tabs" role="tablist" aria-label="樣式分頁">${tabs.map(([k,n])=>`<button role="tab" id="st-${k}" data-act="tab" data-v="${k}" aria-selected="${k===tab}" aria-controls="sp-${k}" tabindex="${k===tab?0:-1}">${n}</button>`).join('')}</div>
   ${tabs.map(([k])=>`<div class="pbody" role="tabpanel" id="sp-${k}" aria-labelledby="st-${k}"${k===tab?'':' hidden'}>${k===tab?panels[k]:''}</div>`).join('')}</section>`;}
export function notePanel(node,S={}){ const m=isMobile(), th=THEMES[(S.doc&&S.doc.theme)||DEFAULT_THEME]||THEMES[DEFAULT_THEME], tg=tagsOf(node);
  const allTags=[...new Set((S.allTags||[]).filter(t=>!tg.includes(t)))];
  const noteLink=!node.link&&/連結：(https?:\/\/\S+)/.exec(node.note||'');
  const sec=(id,icon,title,body,extra='')=>`<section class="nsec" data-sec="${id}" aria-labelledby="ns-${id}"><h4 id="ns-${id}">${I(icon)}${title}${extra}</h4>${body}</section>`;
  const note=sec('note','note','備註',`<label class="sr" for="notearea">備註內容</label><textarea class="ta" id="notearea" data-input="note" placeholder="寫下這個節點的細節…" style="min-height:${m?110:150}px">${esc(node.note||'')}</textarea>`,node.note?`<button class="linkbtn mini" data-act="deleteNote">清除</button>`:'');
  const link=sec('link','link','連結',`${noteLink?`<div class="nhint">${I('info')}<span>備註裡有連結</span><button class="btn mini" data-act="linkFromNote">設成節點連結</button></div>`:''}
    <div class="nrow"><label class="sr" for="linkin">連結網址</label><input class="inpt" id="linkin" type="url" inputmode="url" value="${esc(node.link||'')}" placeholder="https://…" autocomplete="off" spellcheck="false">${node.link?`<a class="btn icononly" href="${esc(node.link)}" target="_blank" rel="noopener noreferrer" aria-label="在新分頁開啟連結">${I('ext')}</a><button class="btn icononly" data-act="linkDel" aria-label="移除連結">${I('x')}</button>`:`<button class="btn" data-act="linkSave">加入</button>`}</div><p class="nerr" id="linkerr" aria-live="polite">${esc(S.linkErr||'')}</p>`);
  const tags=sec('tags','tag','標籤',`<div class="chips" role="list">${tg.map(t=>`<span class="chip" role="listitem">#${esc(t)}<button data-act="tagDel" data-v="${esc(t)}" aria-label="移除標籤 ${esc(t)}">${I('x')}</button></span>`).join('')||'<span class="nnone">還沒有標籤</span>'}</div>
    <div class="nrow"><label class="sr" for="tagin">新增標籤</label><input class="inpt" id="tagin" list="taglist" placeholder="新增標籤，按 Enter" autocomplete="off" enterkeyhint="done"><button class="btn" data-act="tagAdd">加入</button></div>
    ${allTags.length?`<div class="tagsugg"><span>這張圖用過：</span>${allTags.slice(0,8).map(t=>`<button class="chip ghost" data-act="tagAddV" data-v="${esc(t)}">#${esc(t)}</button>`).join('')}</div>`:''}<datalist id="taglist">${allTags.map(t=>`<option value="${esc(t)}">`).join('')}</datalist>`);
  const colors=sec('color','palette','顏色',`<div class="cswatch" role="radiogroup" aria-label="節點顏色（子節點跟著變）"><button class="csw auto" role="radio" data-act="color" data-v="" aria-checked="${!Number.isInteger(node.color)}" aria-label="自動（跟分支）"><i></i><span aria-hidden="true">自動</span></button>${marks(th).map(([c,nm],k)=>`<button class="csw" role="radio" data-act="color" data-v="${k}" aria-checked="${node.color===k}" aria-label="${nm}"><i style="background:${c};box-shadow:inset 0 0 0 1.5px ${readable(c,'#FFFFFF',3)}"></i><span aria-hidden="true">${nm}</span></button>`).join('')}</div><p class="nsub">整個分支一起變色，配色跟著主題。</p>`);
  const img=sec('img','image','圖片',node.img?`<figure class="nimg"><img src="${esc(node.img.src)}" alt="${esc(node.img.alt||node.t)}"><figcaption>${node.img.src.startsWith('data:')?`已嵌入 · ${Math.round(node.img.src.length*3/4/1024)} KB`:`外部圖片 · ${esc(new URL(node.img.src).hostname)}`}</figcaption></figure><div class="nrow"><button class="btn" data-act="imgPick">${I('upload')}替換</button><button class="btn" data-act="imgDel">${I('trash')}移除圖片</button></div>`
    :`<div class="nrow"><button class="btn" data-act="imgPick">${I('upload')}上傳圖片</button><span class="nsub" style="margin:0">或選取節點後直接貼上（${m?'長按 › 貼上':'Ctrl+V'}）</span></div><div class="nrow"><label class="sr" for="imgurl">圖片網址</label><input class="inpt" id="imgurl" type="url" inputmode="url" placeholder="或貼上圖片網址 https://…" autocomplete="off"><button class="btn" data-act="imgUrl">加入</button></div><p class="nsub">上傳的圖片會自動縮小到 640px、150 KB 以內，存在這張圖裡。</p><p class="nerr" id="imgerr" aria-live="polite">${esc(S.imgErr||'')}</p>`);
  const body=note+link+tags+colors+img;
  return m?`<section class="sheet nsheet" data-dock="bottom" aria-label="節點詳情"><div class="grab" aria-hidden="true"></div><h4>${I('note')}<span class="ntitle">${esc(node.t)}</span><button class="icon-btn" style="margin-left:auto" data-act="closePanel" aria-label="關閉">${I('x')}</button></h4><div class="body">${body}</div></section>`
   :`<aside class="stylep notep" data-dock="right" aria-label="節點詳情"><div class="phead"><h3>${I('note')}節點詳情</h3><span class="kbd" style="margin-left:6px">Ctrl+Alt+M</span><button class="icon-btn" style="margin-left:auto" data-act="closePanel" aria-label="關閉節點詳情">${I('x')}</button></div><div class="pbody"><div class="nfor">${node.icon?esc(node.icon)+' ':''}${esc(node.t)}</div>${body}</div></aside>`;}
export function historyPanel(S){ const H=S.hist;
  return `<section class="stylep" data-dock="${isMobile()?'bottom':'right'}" aria-label="版本歷史">
   <div class="phead"><h3>版本歷史</h3><span class="kbd desk-only" style="margin-left:6px">Shift+Alt+H</span><button class="icon-btn" style="margin-left:auto" data-act="closePanel" aria-label="關閉">${I('x')}</button></div>
   <div class="pbody">${S.preview?`<div class="pvcard" role="status"><div>${I('history')}<span>正在預覽 <b>${esc(S.preview.label)}</b> 的版本（唯讀）</span></div><div class="acts"><button class="btn primary" data-act="restore">還原這個版本</button><button class="btn" data-act="endPreview">回到目前版本</button></div></div>`:''}
   <p class="panel-note" style="margin:0 0 12px">${S.backend==='drive'?'Google 雲端硬碟會保留每張圖較近的舊版本（約 30 天、最多 100 個）。還原會新增一個版本，不會改寫舊的。':`每次同步都是 <code>${esc(S.repo.split('/')[1]||'mymind-data')}</code> 的一個 commit（一次同步多張圖也只算一個）。還原會新增一個 commit，不會改寫歷史。`}</p>
   ${!S.remote?`<p class="panel-note">目前「只存瀏覽器」，沒有版本歷史。到 設定 › 儲存與同步 打開 GitHub 或 Google 雲端硬碟同步後，每次同步都會留下一個版本。</p>`:S.driveAuth?`<div class="alert warn" role="note">${I('info')}<div>重新連結 Google 才能讀取版本紀錄。<button class="btn" style="margin-top:8px" data-act="syncNow">重新連結</button></div></div>`:H.loading?`<p class="panel-note" role="status">讀取中…</p>`:H.error?`<div class="alert err" role="alert">${I('alert')}<div>${esc(H.error)}</div></div>`:!H.items.length?`<p class="panel-note">這張圖還沒有同步到 ${esc(S.backendName||'GitHub')}。</p>`:
   `<ul class="hist">${H.items.map((i,k)=>`<li class="${S.preview&&S.preview.sha===i.sha?'on':''} ${k===0?'cur':''}" tabindex="0" role="button" data-act="preview" data-v="${i.sha}" aria-label="${esc(rel(i.date))} ${esc(i.msg)}"><b>${esc(rel(i.date))}${k===0?' · 目前版本':''}</b><div class="m">${esc(i.msg)}</div><div class="s">${S.backend==='drive'?'':`<code>${i.sha.slice(0,7)}</code>`}<span>${esc(i.author||'')}</span></div></li>`).join('')}</ul>
   ${S.backend==='drive'?'':`<a class="btn" style="width:100%;margin-top:10px" href="https://github.com/${esc(S.repo)}/commits/main/maps/${esc(S.mapId)}.json" target="_blank" rel="noopener">${I('ext')}在 GitHub 上看完整紀錄</a>`}`}</div></section>`;}
export function outlineView(root,S={}){ const rows=[]; const m=isMobile(); let N=0;
  (function w(n,lv){ N++; const k=n.c||[], has=k.length>0, tg=tagsOf(n);
    rows.push(`<div class="olr${S.olId===n.id?' cur':''}${lv===0?' root':lv===1?' l1':''}" role="treeitem" aria-level="${lv+1}"${has?` aria-expanded="${!n.collapsed}"`:''} data-id="${n.id}" style="--lv:${lv}">
      ${has&&lv>0?`<button class="oltog" data-act="olToggle" data-v="${n.id}" tabindex="-1" aria-label="${n.collapsed?'展開':'收合'}「${esc(n.t)}」">${I(n.collapsed?'chevR':'chevD')}</button>`:'<span class="oltog sp" aria-hidden="true"></span>'}
      <span class="olb${n.collapsed&&has?' fold':''}" aria-hidden="true"></span>${n.icon?`<span class="olic" aria-hidden="true">${esc(n.icon)}</span>`:''}
      <input class="olin${n.done?' done':''}" data-olid="${n.id}" value="${esc(n.t)}" aria-label="第 ${lv+1} 層${n.collapsed&&has?'（已收合）':''}" autocomplete="off" spellcheck="false" enterkeyhint="next">
      <span class="olmeta">${tg.map(t=>`<span class="oltag">#${esc(t)}</span>`).join('')}${n.link?`<a class="olmi" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-label="開啟連結">${I('link')}</a>`:''}${n.img?`<span class="olmi" title="有圖片" aria-label="有圖片">${I('image')}</span>`:''}${n.note?`<button class="olmi" data-act="olNote" data-v="${n.id}" tabindex="-1" aria-label="備註：${esc(n.note.slice(0,40))}">${I('note')}</button>`:''}</span></div>`);
    if(!n.collapsed||lv===0) k.forEach(c=>w(c,lv+1)); })(root,0);
  return `<div class="outline" role="region" aria-label="大綱（可編輯）"><div class="doc"><div class="olhead"><div><h2>大綱</h2><p class="olhint">${m?'點一行就能改字；下方按鈕可縮排、移動或刪除。':'直接改字 · <span class="kbd">Enter</span> 新增 · <span class="kbd">Tab</span> 縮排 · <span class="kbd">Shift+Tab</span> 退一層 · <span class="kbd">Alt+↑↓</span> 移動 · <span class="kbd">Esc</span> 回心智圖'}</p></div><button class="btn" data-act="outline">${I('mapic')}回到心智圖</button></div>
    <div class="olt" role="tree" aria-label="${esc(root.t)}，共 ${N} 個節點">${rows.join('')}</div></div>
    ${m?`<div class="olbar" role="toolbar" aria-label="大綱編輯">${[['olOutdent','outdent','取消縮排'],['olIndent','indent','縮排'],['olUp','up','上移'],['olDown','down','下移'],['olAdd','plus','新增'],['olDel','trash','刪除']].map(([a,i,l])=>`<button data-act="${a}" aria-label="${l}">${I(i)}<span>${l}</span></button>`).join('')}</div>`:''}</div>`;}

export function homeTop(S,title){return `<header class="top"><button class="icon-btn mobile-only" data-act="nav" aria-label="開啟選單：分類、設定、GitHub 狀態">${I('menu')}</button><div class="title"><h1>${esc(title)}</h1></div><div class="right-actions"><button class="btn desk-only" data-act="mdImport">${I('paste')}匯入／貼上大綱</button><button class="btn primary" data-act="ai">${I('spark')}AI 產生</button></div></header>`;}
const starter=()=>`<div class="starter">
    <button class="stc" data-act="new"><div class="ic" style="background:#EEF0FF;color:#3F51E8">${I('plus')}</div><div><b>空白心智圖</b><span>從中心主題開始</span></div></button>
    <button class="stc" data-act="ai"><div class="ic" style="background:#F3EEFE;color:#7C3AED">${I('spark')}</div><div><b>AI 產生</b><span>輸入主題或筆記</span></div></button>
    <button class="stc" data-act="aiNotes"><div class="ic" style="background:#E6F4EE;color:#0E7A56">${I('note')}</div><div><b>會議紀錄</b><span>AI 整理成圖</span></div></button>
    <button class="stc" data-act="mdImport"><div class="ic" style="background:#FDF4E3;color:#B45309">${I('paste')}</div><div><b>匯入／貼上大綱</b><span>Markdown／OPML</span></div></button></div>`;
const EMPTY_ART=`<svg width="220" height="120" viewBox="0 0 220 120" aria-hidden="true"><g fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M74 60H92V30Q92 22 100 22H118" stroke="#E06A48"/><path d="M74 60H118" stroke="#E06A48"/><path d="M74 60H92V90Q92 98 100 98H118" stroke="#E06A48"/></g><rect x="10" y="44" width="64" height="32" rx="16" fill="#FFBB91" stroke="#E06A48" stroke-width="1.5"/><rect x="118" y="11" width="60" height="22" rx="8" fill="#fff" stroke="#E06A48" stroke-width="1.5"/><rect x="118" y="49" width="60" height="22" rx="8" fill="#fff" stroke="#E06A48" stroke-width="1.5"/><rect x="118" y="87" width="60" height="22" rx="8" fill="#fff" stroke="#E06A48" stroke-width="1.5"/></svg>`;
const DAY=864e5;
function backupNote(S,n){ if(!n||S.remote) return ''; const p=S.prefs||{}; const last=p.lastBackup?Date.parse(p.lastBackup):0, snooze=p.backupSnooze?Date.parse(p.backupSnooze):0;
  if(Date.now()-last<7*DAY||Date.now()-snooze<3*DAY) return '';
  return `<div class="warnbox backupnote" role="note">${I('info')}<div><b>只存在這個瀏覽器。</b>清除瀏覽資料或網站資料時，圖會一起被刪除。${last?'上次備份 '+rel(p.lastBackup)+'。':'建議定期匯出一份備份。'}</div><div class="bacts"><button class="btn" data-act="backup">${I('download')}匯出備份</button><button class="btn ghost" data-act="dismissBackup">稍後</button></div></div>`; }
function installNote(S){ const p=S.prefs||{}; if(!S.canInstall||(p.installHide&&Date.now()-Date.parse(p.installHide)<30*DAY)) return '';
  return `<div class="installnote" role="note"><div class="iic" aria-hidden="true">${LOGO.replace('<svg ','<svg style="width:22px;height:22px" ')}</div><div class="itx"><b>把 MyMind 安裝到主畫面</b><span>像 App 一樣從桌面開啟，沒有網路也能看圖和編輯</span></div><div class="bacts"><button class="btn primary" data-act="install">${I('download')}安裝</button><button class="btn ghost" data-act="installLater">稍後</button></div></div>`; }
export function updateBar(v){ return `<div class="updbar" id="updbar" role="status" aria-live="polite">${I('spark')}<span><b>有新版本${v?' v'+esc(v):''}</b><span class="ux">，重新整理就能使用</span></span><button class="btn primary" data-act="swReload">重新整理</button><button class="icon-btn" data-act="swLater" aria-label="稍後再說">${I('x')}</button></div>`; }
export function home(S,list,docs){ const f=S.filter; const titles={all:'所有心智圖',starred:'已加星號',recent:'最近開啟',trash:'垃圾桶'};
  let items=list.filter(m=>f==='trash'?m.trashed:!m.trashed).filter(m=>f!=='starred'||m.star);
  if(f==='recent') items=items.filter(m=>m.opened).sort((a,b)=>(b.opened||'').localeCompare(a.opened||''));
  else items.sort((a,b)=>S.sort==='name'?(a.title||'').localeCompare(b.title||'','zh-Hant'):S.sort==='created'?(b.created||'').localeCompare(a.created||''):(b.updated||'').localeCompare(a.updated||''));
  const q=(S.q||'').trim().toLowerCase(); const shown=q?items.filter(m=>(m.title||'').toLowerCase().includes(q)):items;
  const live=list.filter(m=>!m.trashed);
  const cards=shown.map(m=>{const d=docs(m.id), th=THEMES[m.theme||DEFAULT_THEME];return `<div class="card"><a href="#/map/${m.id}" class="thumb" style="display:block;background-color:${th.canvas}" aria-label="開啟 ${esc(m.title)}">${d?thumbSvg(d.root,th,d&&JSON.stringify(d.root).length>8000?20:30,d.settings||{}):''}</a>
      <div class="cinfo"><div class="fi" style="background:${th.canvas==='#FFFFFF'?'#FFF1E6':th.canvas}" aria-hidden="true">${esc(m.icon||'🧠')}</div><div style="min-width:0"><b>${esc(m.title||'未命名')}</b><span class="meta">${m.star?'<span class="star" aria-label="已加星號">★</span>':''}${f==='trash'?'刪除於 '+rel(m.trashedAt):rel(m.updated)+' 編輯'}${m.dirty&&S.remote?'<span class="badge">未同步</span>':''}</span></div><button class="icon-btn more" data-act="cardMenu" data-v="${m.id}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(m.title)} 的更多動作">${I('more')}</button></div></div>`;}).join('');
  const emptyBox=q?`<div class="empty"><h3>找不到「${esc(S.q)}」</h3><p>換個關鍵字，或清除搜尋看全部的圖。</p><div class="acts"><button class="btn" style="height:44px" data-act="clearSearch">清除搜尋</button></div></div>`
    :f==='trash'?`<div class="empty"><h3>垃圾桶是空的</h3><p>移到垃圾桶的圖會保留在這裡，可以還原或永久刪除。</p></div>`
    :f==='starred'?`<div class="empty"><h3>還沒有加星號的圖</h3><p>在圖卡的「⋯」選單裡選「加星號」。</p></div>`
    :`<div class="empty">${EMPTY_ART}<h3>開始你的第一張心智圖</h3><p>從空白開始、讓 AI 整理一段筆記，或匯入 Markdown 大綱。<br>${S.remote?'先存在這個瀏覽器，同步時寫進你的私人儲存庫。':'圖會存在這個瀏覽器，不需要帳號；想多台裝置同步再連接 GitHub。'}</p>
      <div class="acts"><button class="btn primary" style="height:44px" data-act="new">${I('plus')}空白心智圖</button><button class="btn ai-go" style="height:44px" data-act="ai">${I('spark')}用 AI 產生</button><button class="btn" style="height:44px" data-act="mdImport">${I('paste')}匯入／貼上大綱</button></div></div>`;
  return `${homeTop(S,titles[f])}<div class="home" id="content"><h2>${f==='all'?'歡迎 👋':titles[f]}</h2><div class="sub">${live.length} 張心智圖 · 存在這個瀏覽器${S.remote?' · '+MODE_NAME[S.syncMode]+'到 '+esc(S.repo):''}</div>
   ${installNote(S)}${backupNote(S,live.length)}
   ${f==='all'?starter():''}
   ${items.length||q?`<div class="hbar"><label class="search">${I('search')}<span class="sr">搜尋心智圖標題</span><input id="homeq" data-input="q" value="${esc(S.q||'')}" placeholder="搜尋心智圖標題…" autocomplete="off"><span class="kbd desk-only">/</span></label>
     <div class="seg" style="margin-left:auto" role="group" aria-label="排序">${[['updated','最近編輯'],['name','名稱'],['created','建立時間']].map(([v,n])=>`<button data-act="sort" data-v="${v}" aria-pressed="${S.sort===v}">${n}</button>`).join('')}</div>
     <select class="sortsel" aria-label="排序" data-input="sort">${[['updated','排序：最近編輯'],['name','排序：名稱'],['created','排序：建立時間']].map(([v,n])=>`<option value="${v}"${S.sort===v?' selected':''}>${n}</option>`).join('')}</select></div>`:''}
   ${shown.length?`<div class="grid">${cards}</div>`:emptyBox}</div>`;}
export function welcome(){ return `<div class="welcome" id="content"><div class="hero"><div class="logo" style="width:56px;height:56px;border-radius:16px;margin:0 auto" aria-hidden="true">${LOGO.replace('<svg ','<svg style="width:30px;height:30px" ')}</div>
   <h1>歡迎使用 MyMind</h1><p class="lead">打開就能畫心智圖，圖會存在這個瀏覽器。想在手機和電腦之間同步、保留版本紀錄時，再連接 GitHub 或 Google 雲端硬碟（選用）。</p></div>
   <div class="choices">
    <div class="choice rec"><h3>${I('laptop')}先存在這個瀏覽器<span class="tagrec">建議</span></h3><ul><li>不用帳號，馬上開始</li><li>所有功能都能用（AI 需要 OpenAI 金鑰）</li><li>可以隨時匯出全部備份、之後再連接 GitHub</li></ul><p class="wnote">${I('info')}<span>清除瀏覽器的網站資料時，圖會一起刪除，記得定期備份</span></p><button class="btn primary" data-act="welcomeLocal">先存在這個瀏覽器</button></div>
    <div class="choice"><h3>${I('cloud')}同步到雲端<span class="tagopt">選用</span></h3><ul><li>手機、電腦同步</li><li>保留版本紀錄</li><li>可選手動同步或每幾分鐘自動同步</li></ul><p class="wnote2">Google 雲端硬碟：用 Google 帳號登入即可 · GitHub：約 2 分鐘建立金鑰</p><div class="wbtns"><button class="btn" data-act="welcomeDrive">連結 Google 雲端硬碟</button><button class="btn" data-act="welcomeGithub">連接 GitHub</button></div></div>
   </div>
   <p class="wfoot">已經有大綱？<button class="linkbtn" data-act="welcomeMd">貼上 Markdown 建立第一張圖</button></p>
   <p class="wfoot" style="margin-top:6px">之後可以在 設定 › 儲存與同步 隨時更改。</p></div>`;}
function lineSample(c){return `<svg class="lsample" viewBox="0 0 132 52" aria-hidden="true"><rect x=".5" y=".5" width="131" height="51" rx="8" fill="#FFFFFF" stroke="var(--ctl)"/><rect x="8" y="17" width="34" height="18" rx="9" fill="#FFBB91" stroke="${c}" stroke-width="1.5"/><path d="M42 26H52M52 13.5V38.5M52 13.5H62M52 38.5H62" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/><rect x="62" y="5" width="44" height="17" rx="5" fill="#FFFFFF" stroke="${c}" stroke-width="1.5"/><rect x="62" y="30" width="44" height="17" rx="5" fill="#FFFFFF" stroke="${c}" stroke-width="1.5"/><path d="M106 13.5H114M106 38.5H114" stroke="${c}" stroke-width="1.5"/><rect x="117" y="11" width="10" height="5" rx="2.5" fill="#3B2A20"/><rect x="117" y="36" width="10" height="5" rx="2.5" fill="#3B2A20"/></svg>`;}
export function settingsDialog(S,D){ const a11y=D.tab==='a11y', data=D.tab==='data', p=D.form;
  const mode=p.sync||'local', hasPat=!!(p.pat||'').trim(), bk=p.backend||'github', drv=bk==='drive', dv=D.drive, bn=drv?'Google 雲端硬碟':'GitHub';
  const bradio=(v,ic,t,sub)=>`<button class="radio bkradio" role="radio" data-act="formBackend" data-v="${v}" aria-checked="${bk===v}"><span class="dot"></span><div><b>${I(ic)}${t}</b><span>${sub}</span></div></button>`;
  const driveCard=dv&&dv.email?`<div class="gdcard ok" role="group" aria-label="Google 雲端硬碟帳號"><div class="gdav" aria-hidden="true">${esc((dv.name||dv.email).trim().slice(0,1).toUpperCase())}</div><div class="gdinfo"><b>已連結 ${esc(dv.email)}</b><span>檔案在你的雲端硬碟「MyMind」資料夾，每張圖一個 .mymind 檔，另有 index.json 目錄。</span></div>
      ${D.driveAuth?`<button class="btn primary" data-act="driveConnect">${I('cloud')}重新連結</button>`:''}<button class="btn" data-act="driveDisconnect">中斷連結</button></div>
      ${D.driveAuth?`<p class="sub" style="margin-top:6px">這個分頁還沒有登入憑證（重新整理或超過約 1 小時就要再按一次）。修改都先存在這個瀏覽器，不會遺失。</p>`:''}`
    :`<div class="gdcard"><div class="gdinfo"><b>用 Google 帳號連結</b><span>會開啟 Google 的登入視窗。MyMind 只能存取<b>它自己建立的檔案</b>（drive.file 權限），看不到你雲端硬碟裡的其他東西。</span></div><button class="btn primary gdbtn" data-act="driveConnect"${D.driveBusy?' aria-busy="true" disabled':''}>${I('cloud')}${D.driveBusy?'連結中…':'連結 Google 雲端硬碟'}</button></div>
      <details class="gdhelp"><summary>看到「Google 尚未驗證這個應用程式」？</summary><p>MyMind 還在 Google 的「測試」階段，所以會出現這個提醒。確認網址是 <code>accounts.google.com</code> 後，按「繼續」（或「進階」→「前往 hctsaik.github.io」），再勾選「查看、編輯、建立及刪除這個應用程式所使用的 Google 雲端硬碟檔案」。</p></details>`;
  const where=`<section class="setsec"><h4 id="bk-h">同步到哪裡</h4><p class="sub">一次只用一個雲端。切換後，這個瀏覽器裡的圖會在下次同步時上傳到新的地方；原本那邊的資料不會被刪除。</p>
    <div class="choices2 bkopts" role="radiogroup" aria-labelledby="bk-h">${bradio('drive','cloud','Google 雲端硬碟','用 Google 帳號登入；不用金鑰')}${bradio('github','git','GitHub','私人儲存庫；每次同步 1 個 commit')}</div>
    ${drv?driveCard:`<p class="sub" style="margin-top:8px">${hasPat?`已設定金鑰 · <code>${esc(p.repo)}</code>`:'還沒有金鑰'} · <button class="linkbtn" data-act="setTab" data-v="gh">GitHub 與 AI 設定</button></p>`}
    ${D.driveErr?`<div class="alert err" role="alert" style="margin-top:10px">${I('alert')}<div>${esc(D.driveErr)}</div></div>`:''}</section>`;
  const radio=(v,t,sub)=>`<button class="radio" role="radio" data-act="formSync" data-v="${v}" aria-checked="${mode===v}"><span class="dot"></span><div><b>${t}</b><span>${sub}</span></div></button>`;
  const dataTab=`${where}<section class="setsec"><h4 id="sm-h">同步方式</h4><p class="sub">圖一律先存在這個瀏覽器（IndexedDB）。雲端同步是選用的。</p>
    <div class="choices2 syncopts" role="radiogroup" aria-labelledby="sm-h">
     ${radio('local','只存瀏覽器','不連網路。換裝置或清除網站資料前請先匯出備份。')}
     ${radio('manual',`手動同步到 ${bn}`,drv?'修改先存本機；按「同步」或 Ctrl+S 時，所有未同步的圖一起上傳。':'修改先存本機；按「同步」或 Ctrl+S 時，所有未同步的圖一起寫成 1 個 commit。')}
     ${radio('auto','自動同步',drv?'有修改時最多每 3 分鐘上傳一次，切換分頁或關閉時也會同步。':'有修改時最多每 3 分鐘同步一次，切換分頁或關閉時也會同步；每次 1 個 commit。')}
    </div>${mode!=='local'&&!drv&&!hasPat?`<div class="alert warn" role="note" style="margin-top:10px">${I('info')}<div>需要 GitHub 金鑰：到「GitHub 與 AI」分頁貼上金鑰。</div></div>`:mode!=='local'&&drv&&!(dv&&dv.email)?`<div class="alert warn" role="note" style="margin-top:10px">${I('info')}<div>先按上面的「連結 Google 雲端硬碟」。</div></div>`:''}</section>
   <section class="setsec"><h4>瀏覽器儲存</h4>
    <div class="warnbox" role="note">${I('info')}<div>圖存在<b>這個瀏覽器</b>裡。清除瀏覽資料、網站資料，或使用無痕視窗時，圖可能會被刪除；換電腦或換瀏覽器也看不到。請定期匯出備份。</div></div>
    <ul class="kv">
     <li><span>儲存位置</span><b>${D.backend==='idb'?'IndexedDB':D.backend==='local'?'localStorage（這個瀏覽器不支援 IndexedDB）':'—'}</b></li>
     <li><span>心智圖</span><b>${S.mapCount||0} 張${D.usage?' · 約 '+(D.usage/1024<1024?Math.max(1,Math.round(D.usage/1024))+' KB':(D.usage/1048576).toFixed(1)+' MB'):''}</b></li>
     <li><span>長期保留</span><b>${D.persisted===undefined?'檢查中…':D.persisted?'瀏覽器已同意保留，不會自動清掉':'空間不足時可能被清掉'}</b>${D.persisted===false?`<button class="btn" data-act="askPersist">要求保留</button>`:''}</li>
     <li><span>上次備份</span><b>${D.lastBackup?rel(D.lastBackup):'還沒有備份'}</b></li>
    </ul>
    <div class="bkacts"><button class="btn primary" data-act="backup">${I('download')}匯出全部備份（.mymind）</button><button class="btn" data-act="restore">${I('upload')}從備份還原</button></div>
    <p class="sub" style="margin-top:8px">備份是一個 JSON 檔，包含所有心智圖（含垃圾桶），不含金鑰。還原時同一張圖保留較新的版本。</p></section>`;
  const gh=`<div class="stepcard"><h4><i>1</i>開啟 GitHub，建立一把金鑰</h4>
      <a class="btn primary" style="height:44px" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">${I('ext')}開啟 GitHub 建立金鑰</a>
      <ul class="check">
       <li><span>名稱 <em>Token name</em>：填 <b>mymind</b>；期限 <em>Expiration</em>：<b>90 天</b></span></li>
       <li><span>儲存庫 <em>Repository access</em>：選 <b>只限指定儲存庫</b> <em>Only select repositories</em> → 勾 <b>mymind-data</b></span></li>
       <li><span>權限 <em>Permissions</em> → <em>Repository permissions</em> → 內容 <em>Contents</em>：<b>可讀寫</b> <em>Read and write</em>；其他都不用開（<em>Metadata</em> 會自動變成唯讀）</span></li>
      </ul></div>
    <div class="stepcard"><h4><i>2</i>貼上金鑰並測試</h4>
      <div class="field"><label for="f-repo">資料儲存庫（擁有者/名稱）</label><div class="inp ${D.test&&D.test.ok?'ok':''}">${I('folder')}<input id="f-repo" data-form="repo" value="${esc(p.repo)}" autocomplete="off" spellcheck="false"></div></div>
      <div class="field"><label for="f-pat">金鑰（以 github_pat_ 開頭）</label><div class="inprow"><div class="inp ${D.test&&D.test.ok?'ok':''}">${I('key')}<input id="f-pat" type="password" data-form="pat" value="${esc(p.pat)}" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></div><button class="btn" style="height:44px" data-act="testGithub">測試</button></div>
      ${D.test?D.test.ok?`<span class="chip-ok" role="status">${I('check')} ${esc(D.test.msg)}</span>`:`<div class="alert err" role="alert" style="margin-top:10px">${I('alert')}<div>${esc(D.test.msg)}</div></div>`:''}</div></div>
    <details class="stepcard opt-ai" open><summary><i style="font-style:normal;width:24px;height:24px;border-radius:50%;background:var(--ai-soft);color:var(--ai);font-size:12.5px;font-weight:700;display:grid;place-items:center">3</i>OpenAI 金鑰（選填，AI 功能才需要）</summary>
      <div class="field"><label for="f-oai">API 金鑰 · 到 platform.openai.com → API keys 建立</label><div class="inp">${I('key')}<input id="f-oai" type="password" data-form="openai" value="${esc(p.openai)}" autocomplete="off" spellcheck="false" placeholder="sk-…"></div></div>
      <div class="field"><label for="f-model">模型</label><div class="inp"><input id="f-model" data-form="model" value="${esc(p.model)}" list="models" autocomplete="off"><datalist id="models"><option value="gpt-4o-mini"><option value="gpt-4o"><option value="gpt-4.1-mini"></datalist></div></div></details>`;
  const light=p.lines==='light';
  const ax=`<section class="setsec"><h4 id="ln-h">線條顏色</h4><p class="sub">套用到「珊瑚」「蜜桃奶茶」的連線和第一層外框。其他主題的線條本來就達到 3:1。</p>
    <div class="choices2 lineopts" role="radiogroup" aria-labelledby="ln-h">
     <button class="radio" role="radio" data-act="formLines" data-v="standard" aria-checked="${!light}"><span class="dot"></span><div><b>標準線條（預設）</b><span><code>#E06A48</code> · 白底 3.32:1、蜜桃底 3.00:1，符合 WCAG 1.4.11（非文字 ≥ 3:1）</span></div>${lineSample('#E06A48')}</button>
     <button class="radio" role="radio" data-act="formLines" data-v="light" aria-checked="${light}"><span class="dot"></span><div><b>淺色線條</b><span><code>#FF8E6E</code> · 最像參考圖、較柔和；白底只有 2.25:1、蜜桃底 2.03:1，密圖較難看清</span></div>${lineSample('#FF8E6E')}</button>
    </div></section>
   <section class="setsec"><h4 id="ui-h">介面</h4><div class="seg" role="group" aria-labelledby="ui-h">${[['light','淺色'],['dark','深色'],['system','跟隨系統']].map(([v,n])=>`<button data-act="formUi" data-v="${v}" aria-pressed="${p.ui===v}">${n}</button>`).join('')}</div></section>
   <section class="setsec setrow"><div><h4 id="rm-h">減少動態效果</h4><p class="sub">關掉節點展開、面板滑入的動畫</p></div><button class="toggle" role="switch" data-act="formMotion" aria-checked="${!!p.reduceMotion}" aria-labelledby="rm-h"><i></i></button></section>`;
  return `<div class="scrim" data-act="scrim"><div class="modal settings" role="dialog" aria-modal="true" aria-labelledby="set-h">
   <div class="mhead"><div class="spark" style="background:linear-gradient(135deg,#1F2329,#3F51E8)" aria-hidden="true">${I(a11y?'palette':data?'laptop':'git')}</div><div><h3 id="set-h">設定</h3><p>${a11y?'外觀與無障礙 · 只存在這個瀏覽器':data?'圖先存在這個瀏覽器；雲端同步是選用的':'連接 GitHub：大約 2 分鐘，只要做一次'}</p></div><button class="icon-btn close" data-act="closeDialog" aria-label="關閉">${I('x')}</button></div>
   <div class="tabs settabs" role="tablist" aria-label="設定分頁"><button role="tab" id="st-data" data-act="setTab" data-v="data" aria-selected="${data}" aria-controls="sp-data" tabindex="${data?0:-1}">${I('laptop')}儲存與同步</button><button role="tab" id="st-gh" data-act="setTab" data-v="gh" aria-selected="${!a11y&&!data}" aria-controls="sp-gh" tabindex="${!a11y&&!data?0:-1}">${I('git')}GitHub 與 AI</button><button role="tab" id="st-a11y" data-act="setTab" data-v="a11y" aria-selected="${a11y}" aria-controls="sp-a11y" tabindex="${a11y?0:-1}">${I('palette')}外觀與無障礙</button></div>
   <div class="mbody" id="sp-data" role="tabpanel" aria-labelledby="st-data"${data?'':' hidden'}>${data?dataTab:''}</div>
   <div class="mbody" id="sp-gh" role="tabpanel" aria-labelledby="st-gh"${a11y||data?' hidden':''}>${a11y||data?'':(D.syncErr?`<div class="alert err" role="alert" style="margin-bottom:12px">${I('alert')}<div>${esc(D.syncErr)}</div></div>`:'')+gh}</div>
   <div class="mbody" id="sp-a11y" role="tabpanel" aria-labelledby="st-a11y"${a11y?'':' hidden'}>${a11y?ax:''}</div>
   ${a11y?`<div class="mfoot"><span class="info">${I('info')}立即套用到所有心智圖；只存在這個瀏覽器</span><button class="btn primary" style="margin-left:auto" data-act="closeDialog">完成</button></div>`
   :data?`<div class="mfoot"><span class="info">${I('info')}換同步方式後按「儲存」</span><button class="btn" data-act="closeDialog">取消</button><button class="btn primary" data-act="saveSettings">儲存</button></div>`
   :`<div class="mfoot"><div class="warnbox" role="note">${I('info')}<div>金鑰<b>只存在這個瀏覽器</b>（localStorage），不會上傳到程式碼儲存庫。公用電腦請不要儲存；換裝置要重新輸入。</div></div><button class="btn" style="margin-left:auto" data-act="clearKeys">清除金鑰</button><button class="btn primary" data-act="saveSettings">儲存</button></div>`}
  </div></div>`;}
const AIERR={auth:['OpenAI 金鑰無效（401）','金鑰可能打錯、已刪除或沒有額度。你的內容還在，修正後可以直接重試。'],quota:['請求太多或額度用完（429）','稍等一下再試，或到 OpenAI 帳單頁確認額度。'],network:['網路連線失敗','檢查網路後重試；內容不會遺失。'],format:['AI 回傳的格式不對','已自動重試一次仍失敗，請再試一次或簡化內容。'],model:['找不到這個模型（404）','到設定確認模型名稱，例如 gpt-4o-mini。'],nokey:['還沒有設定 OpenAI 金鑰','到 設定 › GitHub 與 AI 貼上 OpenAI 金鑰後再試。'],http:['OpenAI 回傳錯誤','請稍後再試。']};
export function aiDialog(S,A,selNode){ const tabs=[['topic','輸入主題','一句話產生整張圖'],['notes','筆記整理','貼上文字自動整理'],['expand','展開節點','為選取節點發想']];
  const e=A.error&&(AIERR[A.error.kind]||AIERR.http);
  const pane=k=>k==='topic'?`<label for="ai-topic" class="sr">主題</label><textarea class="ta" id="ai-topic" data-ai="topic" style="min-height:90px" placeholder="例如：2027 名古屋家族旅行">${esc(A.topic||'')}</textarea>`
    :k==='notes'?`<label class="sr" for="ai-notes">筆記內容</label><textarea class="ta" id="ai-notes" data-ai="notes" placeholder="貼上會議紀錄、文章或筆記…">${esc(A.notes||'')}</textarea>`
    :`${selNode?`<p class="panel-note" style="margin:0 0 8px">為「<b>${esc(selNode.t)}</b>」新增子主題</p>`:`<p class="panel-note">先開一張圖並選一個節點。</p>`}<label for="ai-hint" class="sr">補充需求</label><textarea class="ta" id="ai-hint" data-ai="hint" style="min-height:80px" placeholder="補充需求（選填），例如：偏重預算">${esc(A.hint||'')}</textarea>`;
  return `<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ai-h">
   <div class="mhead"><div class="spark" aria-hidden="true">${I('spark')}</div><div><h3 id="ai-h">AI 產生心智圖</h3><p>用你的 OpenAI 金鑰，在瀏覽器直接產生</p></div><button class="icon-btn close" data-act="closeDialog" aria-label="關閉">${I('x')}</button></div>
   <div class="mbody">
    ${e?`<div class="alert err" role="alert">${I('alert')}<div><b>${e[0]}</b><br>${e[1]}${A.error.message&&A.error.kind!=='nokey'?`<br><small>${esc(A.error.message).slice(0,160)}</small>`:''}<div class="acts"><button class="btn primary" data-act="settings">前往設定</button><button class="btn" data-act="aiRun">重試</button></div></div></div>`:''}
    <div class="aitabs" role="tablist" aria-label="AI 模式">${tabs.map(([k,b,s])=>`<button class="aitab" role="tab" id="ait-${k}" data-act="aiTab" data-v="${k}" aria-selected="${A.tab===k}" aria-controls="aip-${k}" tabindex="${A.tab===k?0:-1}"><b>${b}</b>${s}</button>`).join('')}</div>
    ${tabs.map(([k])=>`<div role="tabpanel" id="aip-${k}" aria-labelledby="ait-${k}"${A.tab===k?'':' hidden'}>${A.tab===k?pane(k):''}</div>`).join('')}
    <div class="opts">
     <label class="opt"><small>層數</small><select data-ai="depth">${[2,3,4].map(v=>`<option${+A.depth===v?' selected':''} value="${v}">${v} 層</option>`).join('')}</select></label>
     <label class="opt"><small>每層分支</small><select data-ai="breadth">${['3–4','4–6','6–8'].map(v=>`<option${A.breadth===v?' selected':''}>${v}</option>`).join('')}</select></label>
     <div class="opt"><small>模型</small><span>${esc(S.model)}</span></div>
    </div>
    ${A.busy?`<div class="preview" aria-live="polite"><h5>${I('spark')}產生中…</h5><div class="pv"><div class="shimmer" style="width:70%"></div><div class="shimmer" style="width:58%"></div><div class="shimmer" style="width:40%"></div></div></div>`:''}
   </div>
   <div class="mfoot"><span class="info">${I('lock')}金鑰只存在這個瀏覽器</span><button class="btn" data-act="${A.busy?'aiCancel':'closeDialog'}">${A.busy?'停止':'取消'}</button><button class="btn ai-go" data-act="aiRun"${A.busy?' disabled':''}>${I('spark')}${A.tab==='expand'?'產生並插入':'產生新圖'}</button></div>
  </div></div>`;}
export function conflictDialog(C){ const d1=C.mineDiff,d2=C.theirsDiff;
  return `<div class="scrim"><div class="modal" style="width:min(760px,100%)" role="alertdialog" aria-modal="true" aria-labelledby="cf-h" aria-describedby="cf-d">
   <div class="mhead"><div class="spark" style="background:#B45309" aria-hidden="true">${I('merge')}</div><div><h3 id="cf-h">雲端有比較新的版本</h3><p id="cf-d">另一台裝置在 ${esc(C.when||'剛才')} 更新了「${esc(C.title)}」，跟你這邊的修改不同</p></div><button class="icon-btn close" data-act="closeDialog" aria-label="稍後再決定">${I('x')}</button></div>
   <div class="mbody">
    <div class="versions">
     <div class="ver"><div class="thumb" style="background-color:${C.canvas}">${C.mineSvg}</div><div class="vi"><b>我的版本（這台裝置）</b>新增 ${d1.add}、修改 ${d1.mod}、刪除 ${d1.del}</div></div>
     <div class="ver"><div class="thumb" style="background-color:${C.canvas}">${C.theirsSvg}</div><div class="vi"><b>雲端版本 <code>${esc(String(C.sha||'').includes('@')?'v'+String(C.sha).split('@')[1]:(C.sha||'').slice(0,7))}</code></b>新增 ${d2.add}、修改 ${d2.mod}、刪除 ${d2.del}</div></div>
    </div>
    <div class="choices2" role="radiogroup" aria-label="處理方式">
     ${[['merge','合併兩邊（建議）','改到不同節點會自動合併；同一個節點兩邊都改時保留我的。合併後存成新版本。'],['mine','保留我的版本','覆蓋雲端版本；雲端版本仍可從版本歷史救回。'],['theirs','改用雲端版本','我的修改另存成「'+esc(C.title)+'（我的副本）」。']].map(([v,b,s])=>`<button class="radio" role="radio" data-act="cfPick" data-v="${v}" aria-checked="${C.pick===v}"><span class="dot"></span><div><b>${b}</b><span>${s}</span></div></button>`).join('')}
    </div>
   </div>
   <div class="mfoot"><span class="info">${I('info')}不論選哪個，都不會遺失資料</span><button class="btn" data-act="closeDialog">稍後</button><button class="btn primary" data-act="cfApply">套用</button></div>
  </div></div>`;}
export function shortcutsDialog(){ const rows=[['Tab','新增子主題'],['Enter','新增同級'],['Shift+Tab','升一層'],['Space / F2','編輯文字'],['Delete','刪除節點'],['Ctrl+C','複製節點（Markdown）'],['Ctrl+X','剪下節點'],['Ctrl+V','貼上 Markdown／節點'],['Ctrl+Shift+V','開啟「從 Markdown 匯入」'],['↑ ↓ ← →','移動選取'],['Alt+↑ / Alt+↓','上下移動節點'],['Ctrl+.','收合／展開'],['Ctrl+Z / Ctrl+Y','復原／重做'],['Ctrl+S','立刻同步'],['Ctrl+O','大綱'],['Ctrl+Alt+M','節點詳情（備註、連結、標籤、顏色、圖片）'],['Ctrl+1…5','優先順序'],['Ctrl+F','搜尋節點（Enter 下一個、Shift+Enter 上一個）'],['F3 / Shift+F3','下一個／上一個符合'],['/','搜尋心智圖標題'],['F6','隨機換主題'],['Alt+0','跳回畫布'],['Esc','離開畫布／關閉']];
  return `<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="kb-h" style="width:min(520px,100%)"><div class="mhead"><div class="spark" aria-hidden="true">${I('kb')}</div><div><h3 id="kb-h">鍵盤快捷鍵</h3><p>焦點在畫布上時使用 · MyMind v${VERSION}</p></div><button class="icon-btn close" data-act="closeDialog" aria-label="關閉">${I('x')}</button></div><div class="mbody"><table class="kbt">${rows.map(([k,v])=>`<tr><td><span class="kbd">${k}</span></td><td>${v}</td></tr>`).join('')}</table></div></div></div>`;}
export function promptDialog(P){ return `<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="pr-h" style="width:min(440px,100%)"><div class="mhead"><div><h3 id="pr-h">${esc(P.title)}</h3>${P.sub?`<p>${esc(P.sub)}</p>`:''}</div><button class="icon-btn close" data-act="closeDialog" aria-label="關閉">${I('x')}</button></div><div class="mbody">${P.input!==undefined?`<div class="field"><label for="pr-in">${esc(P.label||'')}</label><div class="inp"><input id="pr-in" value="${esc(P.input)}" autocomplete="off"></div></div>`:''}</div><div class="mfoot"><button class="btn" style="margin-left:auto" data-act="closeDialog">取消</button><button class="btn ${P.danger?'danger':'primary'}" data-act="promptOk">${esc(P.ok||'確定')}</button></div></div></div>`;}

// ---------- Markdown import dialog (v1.2) ----------
function mdTreeHtml(n,depth,budget,rt){ if(budget.left<=0) return ''; budget.left--; const kids=(n.c||[]);
  const cls=[rt?'rt':'',n.tgt?'tgt':'',n.done?'done':''].filter(Boolean).join(' ');
  return `<li${cls?` class="${cls}"`:''}><span>${esc(n.t)}${n.note?`<i class="mdnote" title="${esc(n.note)}">${I('note')}<span class="sr">有備註</span></i>`:''}</span>${kids.length&&budget.left>0?`<ul>${kids.map(k=>mdTreeHtml(k,depth+1,budget,false)).join('')}</ul>`:''}</li>`; }
export function mdPreview(tree,count){ if(!tree||!count) return `<div class="mdempty"><b>貼上或輸入 Markdown</b><span>預覽會即時顯示在這裡</span></div>`;
  const budget={left:300}; const html=`<ul class="mdtree">${mdTreeHtml(tree,0,budget,true)}</ul>`; return html+(budget.left<=0?`<p class="mdmore">預覽只顯示前 300 個節點</p>`:''); }
export function mdOkLabel(D,count){ return D.target==='node'?`加入 ${count} 個節點`:`建立心智圖（${count} 個節點）`; }
export function mdDialog(D,tree,count){ const radio=(v,t,sub)=>`<button class="radio" role="radio" data-act="mdTarget" data-v="${v}" aria-checked="${D.target===v}"><span class="dot"></span><div><b>${t}</b><span>${sub}</span></div></button>`;
  return `<div class="scrim" data-act="scrim"><div class="modal mdmodal" role="dialog" aria-modal="true" aria-labelledby="md-h">
   <div class="mhead"><div class="spark" aria-hidden="true">${I('paste')}</div><div><h3 id="md-h">從 Markdown 匯入／貼上</h3><p>標題 #、清單 - * + 1.、縮排都會變成節點</p></div><button class="icon-btn close" data-act="closeDialog" aria-label="關閉">${I('x')}</button></div>
   <div class="mbody">
    ${D.nodeId?`<p class="sr" id="mdt-h">加到哪裡</p><div class="choices2 mdtarget" role="radiogroup" aria-labelledby="mdt-h">${radio('node',`加到「${esc(D.nodeT)}」底下`,'成為選取節點的子主題')}${radio('new','建立新的心智圖','第一個標題當中心主題')}</div>`:''}
    <div class="mdgrid">
     <div class="mdcol"><label for="md-in" class="mdlab">Markdown</label><textarea class="ta mdta" id="md-in" data-input="mdText" spellcheck="false" placeholder="# 名古屋旅行&#10;## 行程&#10;- Day 1&#10;  - 熱田神宮&#10;## 美食&#10;- 味噌豬排">${esc(D.md||'')}</textarea>
      <div class="mdtools"><button class="btn" data-act="mdPick">${I('upload')}選擇檔案…</button><button class="btn" data-act="mdClip">${I('paste')}從剪貼簿貼上</button></div>
      <label class="mdopt"><input type="checkbox" data-md="linkNote"${D.linkNote?'':' checked'}><i class="box" aria-hidden="true">${I('check')}</i><span>網址存成節點的「連結」<small>取消勾選：照舊寫進備註「連結：網址」</small></span></label></div>
     <div class="mdcol"><div class="mdlab" id="md-count" aria-live="polite">預覽 · 共 ${count} 個節點</div><div class="preview mdprev" id="md-prev">${mdPreview(tree,count)}</div></div>
    </div></div>
   <div class="mfoot"><button class="btn" style="margin-left:auto" data-act="closeDialog">取消</button><button class="btn primary" id="md-ok" data-act="mdOk"${count?'':' disabled'}>${mdOkLabel(D,count)}</button></div></div></div>`; }

// ---------- node search bar (v1.3) ----------
export function findCount(F){ if(!F||!F.q.trim()) return ''; if(!F.hits.length) return '找不到'; return `${F.i+1} / ${F.hits.length}`; }
export function findbar(S){ const F=S.find; return `<div class="findbar" id="findbar" role="search" aria-label="搜尋節點"><span class="fic" aria-hidden="true">${I('search')}</span><label class="sr" for="findq">搜尋節點</label><input id="findq" data-input="find" value="${esc(F.q)}" placeholder="搜尋節點文字或備註" autocomplete="off" spellcheck="false" enterkeyhint="search"><span class="fcount" id="findcount" aria-live="polite">${findCount(F)}</span><button class="icon-btn" data-act="findPrev" aria-label="上一個（Shift+Enter）">${I('up')}</button><button class="icon-btn" data-act="findNext" aria-label="下一個（Enter）">${I('chevD')}</button><button class="icon-btn" data-act="findClose" aria-label="關閉搜尋（Esc）">${I('x')}</button></div>`; }

// ---------- layout thumbnails (v1.4) ----------
export function layoutThumb(k){ const L='var(--ctl)', A='var(--accent)', box=(x,y,w,h,f)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${f||'var(--panel)'}" stroke="${f?'none':L}" stroke-width="1.2"/>`;
  const p=d=>`<path d="${d}" fill="none" stroke="${L}" stroke-width="1.4" stroke-linecap="round"/>`;
  let g='';
  if(k==='right') g=p('M30 30H38V12H50M38 30H50M38 30V48H50')+box(8,24,22,12,A)+box(50,7,22,10)+box(50,25,22,10)+box(50,43,22,10);
  else if(k==='balanced') g=p('M51 30H58V15H66M58 30V45H66M29 30H22V15H14M22 30V45H14')+box(29,24,22,12,A)+box(66,10,12,10)+box(66,40,12,10)+box(2,10,12,10)+box(2,40,12,10);
  else g=p('M40 18V24H16V30M40 24H64V30M40 24V30M16 40V46H22M16 46V52H22M64 40V46H70')+box(29,6,22,12,A)+box(6,30,20,10)+box(30,30,20,10)+box(54,30,20,10)+box(22,42,14,8)+box(22,50,14,8)+box(70,42,8,8);
  return `<svg viewBox="0 0 80 60" aria-hidden="true">${g}</svg>`; }

// ---------- icon / emoji picker (v1.4) ----------
export const EMOJI=[
 ['mark','標記',[['⭐️','星 重要 收藏'],['✅','完成 打勾 好'],['❗️','重要 注意 驚嘆'],['❓','問題 疑問'],['💡','想法 點子 靈感'],['📌','釘選 重點'],['🔥','熱門 緊急 火'],['🎯','目標 重點'],['⚠️','警告 風險 注意'],['🚩','旗子 里程碑'],['❌','不要 錯 取消'],['⏳','等待 進行中'],['🔒','鎖 機密 私人'],['👍','讚 同意'],['👎','不同意'],['💯','滿分 完美'],['🏆','獎盃 成就 冠軍']]],
 ['work','工作',[['📅','日期 行程 日曆'],['🗓️','行事曆 計畫'],['⏰','時間 鬧鐘 截止'],['📝','筆記 備註 寫'],['📋','清單 待辦'],['📊','報表 數據 圖表'],['📈','成長 上升'],['📉','下降'],['💼','工作 公事包'],['📁','資料夾 檔案'],['📎','附件 迴紋針'],['✉️','信 郵件 email'],['📞','電話 聯絡'],['💬','討論 對話 留言'],['👥','團隊 人 成員'],['🧑‍💻','工程師 開發 程式'],['🛠️','工具 修理 開發'],['⚙️','設定 齒輪'],['🔍','搜尋 研究'],['🧪','實驗 測試'],['🚀','上線 發布 啟動'],['💰','錢 預算 費用'],['🧾','收據 帳單'],['🎓','學習 畢業 教育']]],
 ['travel','旅行',[['✈️','飛機 航班 機場'],['🚄','高鐵 新幹線 火車'],['🚇','地鐵 捷運'],['🚌','公車 巴士'],['🚗','車 開車 自駕'],['🚲','腳踏車'],['🏨','飯店 住宿 旅館'],['🏯','城 城堡 日本'],['⛩️','神社 鳥居'],['🗼','塔 東京'],['🏖️','海邊 沙灘 度假'],['⛰️','山 登山'],['🗺️','地圖 路線'],['🧳','行李 打包'],['🎫','票 門票'],['📷','拍照 相機'],['🛍️','購物 逛街'],['🎡','遊樂園']]],
 ['food','美食',[['🍜','拉麵 麵 美食'],['🍣','壽司'],['🍱','便當'],['🍙','飯糰'],['🍛','咖哩 飯'],['🍔','漢堡'],['🍕','披薩'],['🥗','沙拉 健康'],['🍰','蛋糕 甜點'],['☕️','咖啡'],['🍵','茶'],['🍺','啤酒 喝酒'],['🍷','紅酒'],['🍎','蘋果 水果'],['🥩','肉 牛排'],['🍤','炸蝦 天婦羅']]],
 ['life','生活',[['🏠','家 房子'],['🛒','購物 採買 超市'],['💊','藥 健康'],['🏃','運動 跑步'],['🧘','冥想 放鬆 瑜伽'],['😴','睡覺 休息'],['🎂','生日 慶祝'],['🎁','禮物'],['🎉','慶祝 派對'],['❤️','愛 喜歡 心'],['👶','寶寶 小孩'],['🐶','狗 寵物'],['🐱','貓 寵物'],['🌱','成長 植物 新手'],['☀️','晴天 太陽'],['🌧️','下雨 天氣'],['🎵','音樂'],['📚','書 閱讀 學習'],['🎮','遊戲'],['🎬','電影']]],
 ['face','表情',[['😀','開心 笑'],['😊','微笑 滿意'],['😂','大笑'],['🤔','思考 想一想'],['😮','驚訝'],['😢','難過'],['😡','生氣'],['😎','酷'],['🥳','慶祝'],['🙏','拜託 感謝'],['👏','拍手 鼓掌'],['💪','加油 努力']]]];
export function emojiGrid(list,cur){ const nz=x=>String(x||'').replace(/\uFE0F/g,''); const ci=list.findIndex(([e])=>nz(e)===nz(cur)); const fi=ci<0?0:ci; return list.length?list.map(([e,k],i)=>`<button class="emb" role="gridcell" data-act="emojiSet" data-v="${e}" aria-label="${esc(e)} ${esc(k.split(' ')[0])}" aria-pressed="${i===ci}" tabindex="${i===fi?0:-1}">${e}</button>`).join(''):'<p class="emnone">找不到符合的圖示，換個關鍵字試試（例如：旅行、重要、錢）</p>'; }
export const emojiCatOf=e=>{ const k=String(e||'').replace(/\uFE0F/g,''); return (k&&EMOJI.find(c=>c[2].some(([x])=>x.replace(/\uFE0F/g,'')===k))||EMOJI[0])[0]; };
export function emojiList(D){ const q=(D.q||'').trim().toLowerCase(); if(q) return EMOJI.flatMap(c=>c[2]).filter(([e,k])=>k.toLowerCase().includes(q)||e===q); return (EMOJI.find(c=>c[0]===D.cat)||EMOJI[0])[2]; }
export function emojiDialog(D,cur,recent){ return `<div class="scrim" data-act="scrim"><div class="modal emmodal" role="dialog" aria-modal="true" aria-labelledby="em-h">
  <div class="mhead"><div class="spark" aria-hidden="true">${I('smile')}</div><div><h3 id="em-h">選擇圖示</h3><p>給「${esc(D.nodeT)}」${cur?`，目前：${esc(cur)}`:''}</p></div><button class="icon-btn close" data-act="closeDialog" aria-label="關閉">${I('x')}</button></div>
  <div class="mbody"><div class="emsearch">${I('search')}<label class="sr" for="em-q">搜尋圖示</label><input id="em-q" data-input="emojiQ" value="${esc(D.q||'')}" placeholder="搜尋：旅行、重要、錢、會議…" autocomplete="off"></div>
   ${recent.length&&!D.q?`<div class="emrow"><span class="emlab">最近使用</span><div class="emrecent">${recent.map(e=>`<button class="emb" data-act="emojiSet" data-v="${e}" aria-label="最近使用 ${e}">${e}</button>`).join('')}</div></div>`:''}
   <div class="emcats" role="tablist" aria-label="分類"${D.q?' hidden':''}>${EMOJI.map(([k,l])=>`<button role="tab" data-act="emojiCat" data-v="${k}" aria-selected="${(D.cat||'mark')===k}" tabindex="${(D.cat||'mark')===k?0:-1}">${l}</button>`).join('')}</div>
   <div class="emgrid" id="emgrid" role="grid" aria-label="${D.q?'搜尋結果':'圖示'}">${emojiGrid(emojiList(D),cur)}</div></div>
  <div class="mfoot"><button class="btn" data-act="emojiSet" data-v=""${cur?'':' disabled'}>${I('x')}移除圖示</button><span class="emtip desk-only">方向鍵選擇 · Enter 套用</span><button class="btn" style="margin-left:auto" data-act="closeDialog">取消</button></div></div></div>`; }
