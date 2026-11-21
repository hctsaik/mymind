// core helpers: colour maths (WCAG), icons, themes. No secrets here.
export const P={
 menu:'M4 6h16M4 12h16M4 18h16', search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', plus:'M12 5v14M5 12h14',
 home:'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z', star:'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z',
 clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
 gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
 undo:'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3', redo:'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
 child:'M4 6h7v5H4zM15 14h5v4h-5zM11 8.5h2a2 2 0 0 1 2 2V16', sibling:'M5 4h10v5H5zM5 15h10v5H5zM19 12v6M16 15h6',
 parent:'M14 13h7v6h-7zM3 5h6v5H3zM9 7.5h2a2 2 0 0 1 2 2V16h1', smile:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
 note:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5', spark:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8zM5 3l.6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6z',
 wand:'M15 4V2M15 10V8M12 6h-2M20 6h-2M17.8 3.2l-1.4 1.4M17.8 8.8l-1.4-1.4M3 21l10-10 2 2L5 23z', outline:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
 history:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2', download:'M12 4v11M7 10l5 5 5-5M5 20h14', upload:'M12 20V9M7 14l5-5 5 5M5 4h14', palette:'M12 3a9 9 0 0 0 0 18c1.2 0 2-.8 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 21 9c0-3.3-4-6-9-6zM7.5 11h.01M10 7h.01M15 7h.01',
 minus:'M5 12h14', fit:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', x:'M6 6l12 12M18 6L6 18', check:'M5 12l5 5 9-10',
 cloud:'M7 18a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 17 18zM9 13l2 2 4-4', more:'M5 12h.01M12 12h.01M19 12h.01',
 key:'M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7zM16 9h.01', lock:'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
 edit:'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', git:'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
 folder:'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', copy:'M9 9h11v11H9zM5 15H4V4h11v1', image:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
 back:'M15 18l-6-6 6-6', chevD:'M6 9l6 6 6-6', info:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01', ext:'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
 kb:'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10', alert:'M12 3l10 18H2zM12 10v5M12 18h.01', laptop:'M4 5h16v11H4zM2 19h20', merge:'M6 3v6a6 6 0 0 0 6 6h6M18 21v-6M6 21v-4'
};
P.link='M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2'; P.tag='M3 12V4h8l10 10-8 8z M7.5 7.5h.01'; P.image='M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01'; P.layout='M3 4h7v6H3zM14 4h7v6h-7zM8.5 14h7v6h-7zM6.5 10v2h11v-2M12 12v2'; P.chevR='M9 6l6 6-6 6'; P.indent='M4 5h16M11 10h9M11 15h9M4 20h16M4 9.5l3.5 3L4 15.5'; P.outdent='M4 5h16M11 10h9M11 15h9M4 20h16M7.5 9.5L4 12.5l3.5 3'; P.down='M12 5v14M6 13l6 6 6-6'; P.mapic='M3 12h4M7 12V6h5M7 12v6h5M12 6h7M12 18h7M7 12h12'; P.paste='M9 4h6v3H9zM9 5.5H6V21h12V5.5h-3M9 12h6M9 16h4'; P.mini='M4 5h16v14H4zM12 11h6v6h-6z'; P.up='M12 19V5M6 11l6-6 6 6'; P.rel='M5 19c0-8 6-13 14-13M14 3l5 3-3 5M5 19h.01'; P.group='M3 4h7v6H3zM14 4h7v6h-7zM3 14h7v6H3zM14 14h7v6h-7z'; P.sum='M5 5h14M5 9h14M5 13h9M5 17h6M17 14l2 2 3-4';
export const I=(n,cls='i')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>`;
export const hex2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export const toHex=a=>'#'+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>{const x=hex2(a),y=hex2(b);return toHex(x.map((v,i)=>v+(y[i]-v)*t))};
export const lum=h=>{const c=hex2(h).map(v=>v/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
export const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
export const readable=(fg,bg,min=4.6)=>{let c=fg;const to=lum(bg)>.35?'#000000':'#FFFFFF';for(let t=0;t<=1&&cr(c,bg)<min;t+=.04)c=mix(fg,to,t);return c};
export const tint=(col,a,base)=>mix(base,col,a);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ONE switch for the product default theme (DESIGN §0). */
export const DEFAULT_THEME='coral';
export const THEMES={
 coral:{name:'珊瑚',root:'#FFBB91',rootText:'#3B2A20',rootPill:true,flatRoot:true,br:['#E06A48','#E06A48','#E06A48','#E06A48','#E06A48','#E06A48'],l1:'box',deepBox:true,deep:'plain',edge:'bracket',er:9,line:'#E06A48',lineLight:'#FF8E6E',lw:1.5,hl:'#FFE27A',text:'#3B2A20',canvas:'#FFFFFF',dot:'#FFFFFF'},
 peach:{name:'蜜桃奶茶',root:'#FFBB91',rootText:'#3B2A20',rootPill:true,flatRoot:true,br:['#E06A48','#E06A48','#E06A48','#E06A48','#E06A48','#E06A48'],l1:'box',deepBox:true,deep:'plain',edge:'bracket',er:9,line:'#E06A48',lineLight:'#FF8E6E',lw:1.5,hl:'#FFE27A',text:'#3B2A20',canvas:'#FFF1E6',dot:'#FFF1E6'},
 latte:{name:'奶茶',root:'#4A3428',rootText:'#FFF8EE',br:['#E8D5B5','#F2A65A','#6BB7A8','#F4D35E','#E3A9A0','#A9C0D9'],l1:'tag',deepBox:true,deep:'plain',edge:'bracket',line:'#5A4636',hl:'#FFE27A',rootTop:true,text:'#3B2A20',canvas:'#F6EFE3',dot:'#E8DCCB',banner:true},
 vivid:{name:'繽紛',root:'#FFD54F',rootText:'#3A2E00',br:['#3B82F6','#F97316','#EAB308','#22C55E','#14B8A6','#8B5CF6','#EC4899','#EF4444','#0EA5E9','#84CC16'],l1:'pill',deepBox:true,edge:'bracket',text:'#1F2329',canvas:'#F3F7FC',dot:'#DCE4EF',hl:'#FFF0A0'},
 fresh:{name:'清新',root:'#3F51E8',rootText:'#FFFFFF',br:['#5B6CFF','#18B07B','#F59E0B','#EF5B5B','#8B5CF6','#06B6D4'],l1:'tint',text:'#1F2329',canvas:'#F5F6F8',dot:'#D5D9DF'},
 macaron:{name:'馬卡龍',root:'#FF7A9A',rootText:'#3A2E39',br:['#FF9EB5','#7FD8BE','#FFD166','#8EC5FF','#C3A6FF','#FFB38A'],l1:'solid',text:'#3A2E39',canvas:'#FFF8F5',dot:'#F1DCD5'},
 business:{name:'商務',root:'#1F3A5F',rootText:'#FFFFFF',br:['#3D5A80','#2A9D8F','#E76F51','#5C677D','#264653','#C08A2D'],l1:'outline',text:'#1F2937',canvas:'#F4F6F9',dot:'#D6DCE4'},
 forest:{name:'森林',root:'#2D6A4F',rootText:'#FFFFFF',br:['#40916C','#2F9E8F','#7A9E3D','#B5838D','#6D8B74','#C9A227'],l1:'tint',text:'#1E2B24',canvas:'#F3F7F2',dot:'#D3DFD2'},
 midnight:{name:'夜幕',root:'#7C8CFF',rootText:'#0E1020',br:['#7C8CFF','#3DDC97','#FFC857','#FF6B8B','#B794F6','#4FD1C5'],l1:'tintDark',text:'#E8EAF0',canvas:'#121418',dot:'#2A2E37',dark:true},
 minimal:{name:'極簡',root:'#111111',rootText:'#FFFFFF',br:['#111111','#3A3A3A','#111111','#3A3A3A','#111111','#3A3A3A'],l1:'outline',text:'#111111',canvas:'#FFFFFF',dot:'#E5E5E5'}
};
export const PRI={1:'#C53030',2:'#B45309',3:'#3F51E8',4:'#0E7A56',5:'#57534E'};
