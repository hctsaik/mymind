// OpenAI Chat Completions, called straight from the browser with the user's own key (stored only in localStorage).
export class AIError extends Error{constructor(kind,status,msg){super(msg);this.kind=kind;this.status=status;}}
const SYS=`你是心智圖助手。只輸出 JSON，格式：{"t":"中心主題","c":[{"t":"子主題","c":[...]}]}。
規則：使用繁體中文（台灣用語），每個節點文字精簡（最多 20 字），不要編號、不要 markdown。`;
export async function chat(key,model,messages,{signal}={}){
  let r;
  try{ r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:model||'gpt-4o-mini',messages,response_format:{type:'json_object'},temperature:.4})}); }
  catch(e){ if(e.name==='AbortError') throw e; throw new AIError('network',0,'網路連線失敗'); }
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ const m=(j.error&&j.error.message)||('HTTP '+r.status);
    if(r.status===401) throw new AIError('auth',401,m);
    if(r.status===429) throw new AIError('quota',429,m);
    if(r.status===404) throw new AIError('model',404,m);
    throw new AIError('http',r.status,m); }
  return j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||'';
}
function parseTree(txt){ let o; try{o=JSON.parse(txt);}catch{throw new AIError('format',0,'AI 回傳的格式不是 JSON');}
  if(o&&!o.t&&o.root) o=o.root; if(!o||typeof o.t!=='string') throw new AIError('format',0,'AI 回傳的格式不對（缺少 t）');
  const clean=n=>({t:String(n.t||'').slice(0,120),...(Array.isArray(n.c)&&n.c.length?{c:n.c.filter(x=>x&&x.t).slice(0,30).map(clean)}:{})});
  return clean(o); }
async function withRetry(fn){ try{return await fn();}catch(e){ if(e.kind==='format') return await fn(); throw e; } }
export const generate=(key,model,{topic,notes,depth=3,breadth='4–6'},opt)=>withRetry(async()=>parseTree(await chat(key,model,[{role:'system',content:SYS},{role:'user',content:notes?`把下面的筆記整理成 ${depth} 層的心智圖，每層 ${breadth} 個分支：\n\n${notes}`:`主題：「${topic}」。產生 ${depth} 層的心智圖，每層 ${breadth} 個分支。`}],opt)));
export const expand=(key,model,{path,node,hint},opt)=>withRetry(async()=>parseTree(await chat(key,model,[{role:'system',content:SYS},{role:'user',content:`心智圖路徑：${path.join(' › ')}\n請為節點「${node}」發想 4–6 個子主題（可以再往下一層）${hint?'，需求：'+hint:''}。輸出時 t 用「${node}」。`}],opt)));
