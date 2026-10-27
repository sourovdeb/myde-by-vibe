#!/usr/bin/env node
// API: tool lines on stdin (or file arg) -> ranking JSON on stdout. Usage: scout.js [file] [--budget N]
const fs=require('fs'),{parse,rank,toJSON}=require('./engine.js');
const a=process.argv.slice(2);let file=null,budget=300;
for(let i=0;i<a.length;i++){if(a[i]==='--budget')budget=Number(a[++i]);else file=a[i];}
try{
  if(!(budget>=0))throw new Error('bad budget');
  console.log(JSON.stringify(toJSON(rank(parse(fs.readFileSync(file||0,'utf8')),budget),budget)));
}catch(e){console.error('error: '+e.message);process.exit(1);}
