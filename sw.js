// MyMind service worker: offline app shell. Every release bumps VERSION, which creates a fresh cache;
// the page then shows 「有新版本，重新整理」 and switches only when the user taps it.
const VERSION='1.5.2';
const CACHE='mymind-'+VERSION;
const SHELL=['./','index.html','manifest.webmanifest','css/app.css',
  'js/app.js','js/ai.js','js/core.js','js/gdrive.js','js/github.js','js/io.js','js/mapview.js','js/merge.js','js/store.js','js/version.js','js/views.js',
  'icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/maskable-192.png','icons/maskable-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'}))))); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('mymind-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('message',e=>{ if(e.data==='skipWaiting'||(e.data&&e.data.type==='SKIP_WAITING')) self.skipWaiting(); else if(e.data&&e.data.type==='VERSION') e.source&&e.source.postMessage({type:'VERSION',version:VERSION}); });
self.addEventListener('fetch',e=>{ const r=e.request; if(r.method!=='GET') return; const u=new URL(r.url); if(u.origin!==location.origin) return; // GitHub / OpenAI / fonts go straight to the network
  if(r.mode==='navigate'){ e.respondWith(caches.open(CACHE).then(c=>c.match('index.html')).then(m=>m||fetch(r))); return; }
  e.respondWith(caches.open(CACHE).then(c=>c.match(r,{ignoreSearch:true})).then(m=>m||fetch(r))); });
