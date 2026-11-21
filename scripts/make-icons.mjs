// Regenerate PWA icons from icons/icon.svg. Run: node scripts/make-icons.mjs
import { chromium } from 'playwright-core'; import fs from 'node:fs';
const exe=process.env.CHROME||process.env.HOME+'/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const b=await chromium.launch({executablePath:exe}); const p=await b.newPage();
const glyph='<circle cx="6" cy="12" r="2.6" fill="#fff"/><path d="M8.6 12H11M11 6.5V17.5M11 6.5H19M11 12H19M11 17.5H19" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
const any=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24"><rect width="24" height="24" rx="5.2" fill="#3F51E8"/>${glyph}</svg>`;
const full=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24"><rect width="24" height="24" fill="#3F51E8"/>${glyph}</svg>`; // iOS rounds corners itself
const mask=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24"><rect width="24" height="24" fill="#3F51E8"/><g transform="translate(12 12) scale(.62) translate(-12.5 -12)">${glyph}</g></svg>`; // glyph inside the 80% safe zone
for(const [f,svg,s] of [['icon-192.png',any,192],['icon-512.png',any,512],['maskable-512.png',mask,512],['maskable-192.png',mask,192],['apple-touch-icon.png',full,180]]){
  await p.setViewportSize({width:s,height:s}); await p.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg(s)}`);
  fs.writeFileSync('icons/'+f,await p.locator('svg').screenshot({omitBackground:true})); console.log('icons/'+f); }
await b.close();
