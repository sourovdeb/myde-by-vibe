'use strict';
const NAMES=['Long-form editor','Persistent story bible','Series continuity','Targeted drafting tools','Chapter drafts + cost estimate','Story-aware AI chat','Model choice (fiction-tuned + general)','Style matching','Import / .docx export','Transparent pricing'];
const W=[10,9,8,7,6,5,4,3,2,1],TOTAL=55,V={F:1,P:.5,M:0,U:0},WORDS=80000;
const DEMO=`# name|sourced|import|export_has_bible|hard_filter|usd_per_1k_words|r1..r10 (F full, P partial, M miss, U unverified)
# Demo fixtures, NOT real products. Fill real rows only from official sites/docs.
Demo Tool A|yes|yes|no|no|0.60|F,F,P,F,F,F,F,F,P,F
Demo Tool B|yes|yes|yes|no|0.45|F,F,F,F,P,P,P,P,F,F
Demo Tool C|yes|no|yes|yes|0.10|F,P,M,P,M,P,M,U,M,F
Demo Tool D|no|yes|yes|no|0.20|F,F,F,F,F,F,F,F,F,F`;
const yes=s=>/^(1|y|yes|true)$/i.test(String(s).trim());
function parse(text){
  const out=[];
  String(text).split('\n').forEach((raw,n)=>{
    const l=raw.trim();if(!l||l[0]==='#')return;
    const f=l.split('|'),at='line '+(n+1)+': ';
    if(f.length!==7)throw new Error(at+'need 7 fields');
    const name=f[0].trim();if(!name)throw new Error(at+'empty name');
    const cs=f[5].trim(),cost=Number(cs);
    if(cs===''||!isFinite(cost)||cost<0)throw new Error(at+'bad cost');
    const r=f[6].split(',').map(s=>s.trim().toUpperCase());
    if(r.length!==10||r.some(x=>!Object.hasOwn(V,x)))throw new Error(at+'need 10 statuses F/P/M/U');
    out.push({name,sourced:yes(f[1]),import:yes(f[2]),exportBible:yes(f[3]),hardFilter:yes(f[4]),usdPer1k:cost,r});
  });
  return out;
}
function evaluate(t,budget=300){
  const raw=t.r.reduce((s,x,i)=>s+W[i]*V[x],0);
  const cost=Math.round(t.usdPer1k*WORDS/1000*100)/100,deal=[];
  if(!t.sourced)deal.push('unsourced');
  if(!t.import)deal.push('no import');
  if(!t.exportBible)deal.push('export drops bible');
  if(t.hardFilter)deal.push('hard content filter');
  if(cost>budget)deal.push('cost scales badly');
  return{name:t.name,score:Math.round(raw/TOTAL*100*10)/10,cost,deal,unverified:t.r.filter(x=>x==='U').length,disq:!t.sourced,r:t.r,imp:t.import,exp:t.exportBible};
}
function rank(tools,budget=300){
  const e=tools.map(t=>evaluate(t,budget));
  e.sort((a,b)=>(a.disq-b.disq)||(b.score-a.score)||(a.name<b.name?-1:a.name>b.name?1:0));
  return e.map((x,i)=>({...x,rank:i+1}));
}
function recommend(R){
  const ok=R.filter(x=>!x.disq),c=ok.find(x=>!x.deal.length);
  if(c)return{name:c.name,caution:false};
  return ok.length?{name:ok[0].name,caution:true}:null;
}
function compare(a,b){
  const yn=v=>v?'yes':'no';
  return[...NAMES.map((n,i)=>({req:n,weight:W[i],a:a.r[i],b:b.r[i]})),
    {req:'Cost per 80k words (USD)',weight:null,a:a.cost,b:b.cost},
    {req:'Manuscript import',weight:null,a:yn(a.imp),b:yn(b.imp)},
    {req:'Export keeps story bible',weight:null,a:yn(a.exp),b:yn(b.exp)}];
}
function toJSON(R,budget){
  return{budget,ranking:R.map(x=>({rank:x.rank,name:x.name,score:x.score,cost_80k:x.cost,deal_breakers:x.deal,unverified:x.unverified})),recommendation:recommend(R)};
}
if(typeof module!=='undefined')module.exports={NAMES,W,DEMO,parse,evaluate,rank,recommend,compare,toJSON};
