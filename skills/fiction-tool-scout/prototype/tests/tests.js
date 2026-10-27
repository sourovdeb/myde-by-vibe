'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),cp=require('child_process');
const E=require('../../fiction-tool-scout/scripts/engine.js');
const {parse,evaluate,rank,recommend,compare,toJSON,DEMO,NAMES}=E;
const CLI=path.join(__dirname,'../../fiction-tool-scout/scripts/scout.js');
const HTML=fs.readFileSync(path.join(__dirname,'../web/index.html'),'utf8');
const L='A|y|y|y|n|1|F,F,F,F,F,F,F,F,F,F',F10=Array(10).fill('F');
const mk=(o={})=>({name:'X',sourced:true,import:true,exportBible:true,hardFilter:false,usdPer1k:1,r:[...F10],...o});
const only=(i,s)=>{const r=Array(10).fill('M');r[i]=s;return mk({r});};
const bad=(s,re)=>assert.throws(()=>parse(s),re);
const ev=(o,b)=>evaluate(mk(o),b);
const cli=(args,input=DEMO)=>cp.execFileSync('node',[CLI,...args],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const T=[],t=(n,f)=>T.push([n,f]);
// parse (14)
t('parse fixture gives 4 tools',()=>assert.equal(parse(DEMO).length,4));
t('parse skips comments and blanks',()=>assert.equal(parse('# c\n\n'+L+'\n\n').length,1));
t('parse rejects 6 fields',()=>bad('a|y|y|y|n|1',/7 fields/));
t('parse rejects 8 fields',()=>bad(L+'|x',/7 fields/));
t('parse rejects empty name',()=>bad(' |y|y|y|n|1|'+F10,/empty name/));
t('parse rejects non-numeric cost',()=>bad('a|y|y|y|n|abc|'+F10,/bad cost/));
t('parse rejects negative cost',()=>bad('a|y|y|y|n|-1|'+F10,/bad cost/));
t('parse rejects empty cost',()=>bad('a|y|y|y|n||'+F10,/bad cost/));
t('parse rejects 9 statuses',()=>bad('a|y|y|y|n|1|'+F10.slice(1),/10 statuses/));
t('parse rejects status X',()=>bad('a|y|y|y|n|1|F,F,F,F,F,F,F,F,F,X',/10 statuses/));
t('parse accepts lowercase statuses',()=>assert.deepEqual(parse('a|y|y|y|n|1|f,p,m,u,f,f,f,f,f,f')[0].r.slice(0,4),['F','P','M','U']));
t('parse yes variants',()=>{const p=parse(['a|1|Y|TRUE|yes|1|','b|no|0|false|n|1|'].map(s=>s+F10)[0]+'\n'+'b|no|0|false|n|1|'+F10);assert.deepEqual([p[0].sourced,p[0].import,p[0].exportBible,p[0].hardFilter,p[1].sourced,p[1].import,p[1].exportBible,p[1].hardFilter],[1,1,1,1,0,0,0,0].map(Boolean));});
t('parse trims whitespace',()=>assert.equal(parse('  a  | y |y|y|n| 1 | '+F10.join(' , '))[0].name,'a'));
t('parse error names the line',()=>bad(L+'\nbroken',/line 2:/));
// evaluate (17)
t('all F scores 100',()=>assert.equal(ev().score,100));
t('all M scores 0',()=>assert.equal(evaluate(mk({r:Array(10).fill('M')})).score,0));
t('all U scores 0 with 10 unverified',()=>{const e=evaluate(mk({r:Array(10).fill('U')}));assert.deepEqual([e.score,e.unverified],[0,10]);});
t('all P scores 50',()=>assert.equal(evaluate(mk({r:Array(10).fill('P')})).score,50));
t('req1 only is 18.2',()=>assert.equal(evaluate(only(0,'F')).score,18.2));
t('req10 only is 1.8',()=>assert.equal(evaluate(only(9,'F')).score,1.8));
t('req1 outweighs req2',()=>assert.ok(evaluate(only(0,'F')).score>evaluate(only(1,'F')).score));
t('unsourced is disqualified and flagged',()=>{const e=ev({sourced:false});assert.ok(e.disq&&e.deal.includes('unsourced'));});
t('no import flagged',()=>assert.deepEqual(ev({import:false}).deal,['no import']));
t('export dropping bible flagged',()=>assert.deepEqual(ev({exportBible:false}).deal,['export drops bible']));
t('hard filter flagged',()=>assert.deepEqual(ev({hardFilter:true}).deal,['hard content filter']));
t('cost 0.6/1k is 48 per novel',()=>assert.equal(ev({usdPer1k:.6}).cost,48));
t('cost over budget flagged',()=>assert.deepEqual(ev({usdPer1k:.6},40).deal,['cost scales badly']));
t('cost equal to budget not flagged',()=>assert.deepEqual(ev({usdPer1k:.6},48).deal,[]));
t('clean tool has no flags',()=>assert.deepEqual(ev().deal,[]));
t('flags keep a stable order',()=>assert.deepEqual(ev({sourced:false,import:false,exportBible:false,hardFilter:true,usdPer1k:10}).deal,['unsourced','no import','export drops bible','hard content filter','cost scales badly']));
t('cost rounds to cents',()=>assert.equal(ev({usdPer1k:.333}).cost,26.64));
// rank (6)
t('rank sorts by score desc',()=>assert.deepEqual(rank([mk({name:'lo',r:Array(10).fill('M')}),mk({name:'hi'})]).map(x=>x.name),['hi','lo']));
t('rank puts disqualified last',()=>assert.equal(rank([mk({name:'D',sourced:false}),mk({name:'Z',r:Array(10).fill('M')})])[1].name,'D'));
t('rank breaks ties by name',()=>assert.deepEqual(rank([mk({name:'B'}),mk({name:'A'})]).map(x=>x.name),['A','B']));
t('rank numbers 1..n',()=>assert.deepEqual(rank(parse(DEMO)).map(x=>x.rank),[1,2,3,4]));
t('rank of empty list is empty',()=>assert.deepEqual(rank([]),[]));
t('rank fixture order is A,B,C,D',()=>assert.deepEqual(rank(parse(DEMO)).map(x=>x.name.slice(-1)),['A','B','C','D']));
// recommend (4)
t('recommend skips top tool with deal-breaker',()=>assert.deepEqual(recommend(rank(parse(DEMO))),{name:'Demo Tool B',caution:false}));
t('recommend warns when all flagged',()=>assert.deepEqual(recommend(rank(parse(DEMO),30)),{name:'Demo Tool A',caution:true}));
t('recommend is null when all unsourced',()=>assert.equal(recommend(rank([mk({sourced:false})])),null));
t('recommend is null for empty',()=>assert.equal(recommend([]),null));
// compare (2)
t('compare has 13 rows',()=>{const R=rank(parse(DEMO));assert.equal(compare(R[0],R[1]).length,13);});
t('compare row values',()=>{const R=rank(parse(DEMO)),c=compare(R[0],R[1]);assert.deepEqual([c[0].req,c[0].a,c[4].b,c[11].a,c[12].a],[NAMES[0],'F','P','yes','no']);});
// json (3)
t('json top-level keys',()=>assert.deepEqual(Object.keys(toJSON(rank(parse(DEMO)),300)),['budget','ranking','recommendation']));
t('json row keys',()=>assert.deepEqual(Object.keys(toJSON(rank(parse(DEMO)),300).ranking[0]),['rank','name','score','cost_80k','deal_breakers','unverified']));
t('json round-trips',()=>{const j=toJSON(rank(parse(DEMO)),300);assert.deepEqual(JSON.parse(JSON.stringify(j)),j);});
// cli (4)
t('cli ranks stdin',()=>{const j=JSON.parse(cli([]));assert.deepEqual([j.ranking.length,j.ranking[0].name,j.recommendation.name],[4,'Demo Tool A','Demo Tool B']);});
t('cli honours --budget',()=>assert.ok(JSON.parse(cli(['--budget','40'])).ranking[0].deal_breakers.includes('cost scales badly')));
t('cli exits 1 on bad input',()=>{try{cli([],'bad|x');assert.fail('no exit');}catch(e){assert.equal(e.status,1);}});
t('cli exits 1 on bad budget',()=>{try{cli(['--budget','x']);assert.fail('no exit');}catch(e){assert.equal(e.status,1);}});
// web (2)
t('web page inlines the engine and demo',()=>assert.ok(HTML.includes('function parse(')&&HTML.includes('Demo Tool A')));
t('web page declares safe-area viewport',()=>assert.ok(HTML.includes('viewport-fit=cover')&&HTML.includes('prefers-color-scheme')));
let f=0;for(const [n,fn] of T){try{fn();}catch(e){f++;console.log('FAIL',n,'->',String(e.message).split('\n')[0]);}}
console.log(`${T.length-f}/${T.length} passed`);process.exit(f?1:0);
