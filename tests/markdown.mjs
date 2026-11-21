// Unit tests for Markdown ⇄ nodes (no browser). Run: node tests/markdown.mjs
globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){},key(){},length:0};
const IO=await import('../js/io.js');
const strip=n=>({t:n.t,...(n.icon?{icon:n.icon}:{}),...(n.tags?{tags:n.tags}:{}),...(n.link?{link:n.link}:{}),...(n.img?{img:n.img.src}:{}),...(n.note?{note:n.note}:{}),...(n.done?{done:true}:{}),...(n.c&&n.c.length?{c:n.c.map(strip)}:{})});
const PN=(md,o)=>JSON.stringify(IO.parseMarkdown(md,o).map(strip));
const P=md=>JSON.stringify(IO.parseMarkdown(md).map(strip));
let pass=0,fail=0; const ok=(name,c,info='')=>{ c?pass++:fail++; console.log((c?'PASS ':'FAIL ')+name+(c||!info?'':' — '+info)); };
const eq=(name,md,exp)=>{ const got=P(md); ok(name,got===JSON.stringify(exp),got); };
eq('headings nest by level','# A\n## B\n### C\n## D',[{t:'A',c:[{t:'B',c:[{t:'C'}]},{t:'D'}]}]);
eq('dash list, 2-space indent','- a\n  - b\n    - c\n- d',[{t:'a',c:[{t:'b',c:[{t:'c'}]}]},{t:'d'}]);
eq('star list, 4-space indent','* a\n    * b\n        * c',[{t:'a',c:[{t:'b',c:[{t:'c'}]}]}]);
eq('plus list + tabs','+ a\n\t+ b\n\t\t+ c',[{t:'a',c:[{t:'b',c:[{t:'c'}]}]}]);
eq('numbered 1. and 1)','1. a\n2. b\n   1) b1\n   2) b2',[{t:'a'},{t:'b',c:[{t:'b1'},{t:'b2'}]}]);
eq('plain indented lines','a\n  b\n    c\nd',[{t:'a',c:[{t:'b',c:[{t:'c'}]}]},{t:'d'}]);
eq('mixed heading + list','# 專案\n- 目標\n  - 留存\n## 風險\n- 時程',[{t:'專案',c:[{t:'目標',c:[{t:'留存'}]},{t:'風險',c:[{t:'時程'}]}]}]);
eq('list under h2 nests under it','## A\n- x\n## B\n- y',[{t:'A',c:[{t:'x'}]},{t:'B',c:[{t:'y'}]}]);
eq('tasks','- [ ] todo\n- [x] done',[{t:'todo'},{t:'done',done:true}]);
eq('inline markdown stripped','- **粗體** *斜體* `code` ~~刪除~~ __底線__',[{t:'粗體 斜體 code 刪除 底線'}]);
eq('links → text; first web link → link field, others → note','- 看 [文件](https://ex.com/a) 和 [說明](https://b.com/x)',[{t:'看 文件 和 說明',link:'https://ex.com/a',note:'連結：https://b.com/x'}]);
ok('links option "note" keeps 連結：url in the note (v1.2 behaviour)',PN('- [文件](https://ex.com/a)',{links:'note'})===JSON.stringify([{t:'文件',note:'連結：https://ex.com/a'}]));
eq('leading emoji → icon','- 🏯 名古屋城',[{t:'名古屋城',icon:'🏯'}]);
eq('trailing #tags → tags (numbers are not tags)','- 熱田神宮 #神社 #必去\n- Issue #12',[{t:'熱田神宮',tags:['神社','必去']},{t:'Issue #12'}]);
eq('image line under an item → node image','- 名古屋城\n  ![城](https://ex.com/c.jpg)',[{t:'名古屋城',img:'https://ex.com/c.jpg'}]);
eq('image → alt text','- ![圖說](a.png)',[{t:'圖說',note:'連結：a.png'}]);
eq('quote → note of previous node','- a\n  > 備註一\n  > 備註二\n- b',[{t:'a',note:'備註一\n備註二'},{t:'b'}]);
eq('blank lines, rules, fences ignored','- a\n\n---\n```js\nx()\n```\n- b',[{t:'a'},{t:'x()'},{t:'b'}]);
eq('CRLF and BOM','\uFEFF- a\r\n  - b\r\n',[{t:'a',c:[{t:'b'}]}]);
eq('snake_case and C++ untouched','- snake_case 與 C++ 與 2*3*4',[{t:'snake_case 與 C++ 與 2*3*4'}]);
eq('closing hashes on headings','## 標題 ##',[{t:'標題'}]);
eq('html tags stripped','- <b>粗</b>文字',[{t:'粗文字'}]);
// whole-map rules
ok('fromMarkdown: single H1 is root',IO.fromMarkdown('# 根\n- a\n- b').t==='根'&&IO.fromMarkdown('# 根\n- a\n- b').c.length===2);
const multi=IO.fromMarkdown('第一行\n第二行\n第三行'); ok('fromMarkdown: first line is root when many top items',multi.t==='第一行'&&multi.c.map(x=>x.t).join()==='第二行,第三行');
ok('every node gets an id',JSON.stringify(IO.fromMarkdown('# a\n- b\n  - c')).match(/"id":/g).length===3);
ok('nodesFromMarkdown: many tops → siblings',IO.nodesFromMarkdown('- a\n- b\n- c').length===3);
ok('nodesFromMarkdown: one top → one subtree',IO.nodesFromMarkdown('# a\n- b\n- c').length===1);
ok('empty input throws',(()=>{try{IO.fromMarkdown('  \n\n');return false;}catch{return true;}})());
// export format and round-trips
const tree={t:'根 *星號* 與 `code`',note:'根備註',c:[{t:'1. 不是清單',c:[{t:'# 不是標題',done:true,note:'兩行\n備註'}]},{t:'snake_case 與 C++'},{t:'- dash'},{t:'[不是連結](x)'}]};
const md1=IO.toMarkdown(tree);
ok('root as "# ", children as nested "- "',md1.startsWith('# 根')&&md1.includes('\n- \\1. 不是清單\n  - [x] \\# 不是標題\n'),md1);
const back=IO.fromMarkdown(md1); ok('map → md → map keeps text, notes, done',JSON.stringify(strip(back))===JSON.stringify(strip(tree)),JSON.stringify(strip(back)));
ok('map → md → map → md is stable',IO.toMarkdown(back)===md1);
const sub=IO.toMarkdown(tree.c[0],{asRoot:false}); ok('subtree copy is a "- " list',sub.startsWith('- \\1. 不是清單\n  - [x]'),sub);
ok('subtree md → nodes → md stable',IO.toMarkdown(IO.nodesFromMarkdown(sub)[0],{asRoot:false})===sub);
for(const [name,md] of [['headings','# 專案\n## 目標\n### 留存\n## 風險'],['numbered','# 清單\n1. a\n2. b\n   1. c'],['plain','根\n  a\n    b\n  c'],['tabs','# T\n\t- a\n\t\t- b'],['mixed','# 名古屋\n## 行程\n- Day 1\n  - 熱田神宮\n## 美食\n* 味噌豬排\n* [x] 鰻魚飯']]){
  const m1=IO.toMarkdown(IO.fromMarkdown(md)), m2=IO.toMarkdown(IO.fromMarkdown(m1)); ok('round-trip stable: '+name,m1===m2,m1+'≠'+m2); }
// v1.4 extras round trip
const ex={t:'旅行',c:[{t:'名古屋城',icon:'🏯',tags:['城','必去'],link:'https://ex.com/jo',img:{src:'https://ex.com/c.jpg',alt:'城'},note:'早點去'},{t:'價格 #1 不是標籤'},{t:'文字 #看起來像標籤'},{t:'⭐ 文字開頭的星星'},{t:'貼上的圖',img:{src:'data:image/jpeg;base64,AAAA'}}]};
const exmd=IO.toMarkdown(ex); ok('export: icon, [text](link), #tags, image line, note',exmd.includes('- 🏯 [名古屋城](https://ex.com/jo) #城 #必去\n  ![城](https://ex.com/c.jpg)\n  > 早點去'),exmd);
ok('export: pasted (embedded) images are left out of Markdown',!exmd.includes('data:image'));
const exback=IO.fromMarkdown(exmd); const exs=JSON.stringify(strip(exback).c.slice(0,4)), want=JSON.stringify(strip(ex).c.slice(0,4));
ok('extras round trip (icon, tags, link, image, literal #, literal emoji)',exs===want,exs+' ≠ '+want);
ok('extras md → map → md stable',IO.toMarkdown(exback)===IO.toMarkdown(IO.fromMarkdown(IO.toMarkdown(exback))));
// clipboard html
const html=IO.toClipboardHTML(tree.c[0],false); const nodes=IO.fromClipboardHTML(html);
ok('clipboard HTML carries exact nodes',nodes&&nodes.length===1&&JSON.stringify(strip(nodes[0]))===JSON.stringify(strip(tree.c[0])));
ok('clipboard HTML is a readable list',/<ul><li>1\. 不是清單<ul><li># 不是標題<\/li><\/ul><\/li><\/ul>/.test(html));
ok('foreign HTML ignored',IO.fromClipboardHTML('<ul><li>x</li></ul>')===null);
console.log(`\n${pass}/${pass+fail} passed`); process.exit(fail?1:0);
