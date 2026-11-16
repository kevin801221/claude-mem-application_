#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {config,date,id,safeFile,readReport,approve,collect,weeklyMarkdown,atomic,digest} from './lib/reports.mjs';
import {render} from './lib/slides.mjs';
import {publish} from './lib/publish.mjs';
export async function main(argv=process.argv.slice(2)){
 const command=argv.shift();const options=Object.fromEntries(['data','config','date','start','end','member','out','month','as-of','file','confirm-author','confirm-repo','confirm-member'].map(k=>[k,{type:'string'}]));
 const {values:v}=parseArgs({args:argv,options,strict:true});
 if(!v.data||!v.config)throw Error('Required: --data DATA_DIR --config TEAM_JSON');
 const root=fs.realpathSync(v.data),c=config(v.config);
 if(command==='approve'){if(!v.file||!v['confirm-author'])throw Error('Use --file relative/path --confirm-author member');approve(safeFile(root,v.file),c,v['confirm-author']);return {status:'approved',file:v.file};}
 if(['push-daily','push-weekly'].includes(command)){if(!v.file||!v['confirm-repo']||!v['confirm-member'])throw Error('Explicit --file, --confirm-repo and --confirm-member required');return publish({data:root,config:c,relative:v.file,confirmRepo:v['confirm-repo'],confirmMember:v['confirm-member'],kind:command.slice(5)});}
 if(command==='weekly'){
  id(v.member);if(!c.members.includes(v.member))throw Error('Member not in team');date(v.start);date(v.end);
  const result=collect(root,c,v.start,v.end),relative=`reports/weekly/${v.start}_${v.end}/${v.member}.md`,file=safeFile(root,relative);
  // Weekly generation must never overwrite an approved or manually edited report.
  if(fs.existsSync(file))throw Error('Weekly report exists; review/edit it or choose a new range');
  atomic(file,weeklyMarkdown(c,v.member,v.start,v.end,result));
  if(v.out)await build(v.out,`${v.start}_${v.end}-${v.member}`,{...c,members:[v.member]}, {reports:result.reports.filter(r=>r.meta.member===v.member),coverage:result.coverage.filter(r=>r.member===v.member)},{start:v.start,end:v.end});
  return {status:'draft',file:relative};
 }
 if(!v.out)throw Error('--out required');
 if(command==='daily'){
  date(v.date);id(v.member);if(!c.members.includes(v.member))throw Error('Member not in team');
  const result=collect(root,{...c,members:[v.member]},v.date,v.date);
  if(!result.reports.length)throw Error('Daily PPT requires a reviewed, unchanged report');
  return build(v.out,`${v.date}-${v.member}`,c,result,{start:v.date,end:v.date});
 }
 if(command==='monthly'){
  if(!/^\d{4}-\d{2}$/.test(v.month||''))throw Error('--month YYYY-MM required');
  const start=date(v.month+'-01'),asof=date(v['as-of']);
  const end=new Date(Date.UTC(Number(v.month.slice(0,4)),Number(v.month.slice(5)),0)).toISOString().slice(0,10);
  if(asof<start)throw Error('Cutoff before month');const cutoff=asof<end?asof:end;
  return build(v.out,`${v.month}-team`,c,collect(root,c,start,cutoff),{start,end:cutoff});
 }
 if(command==='archive'){
  if(!/^\d{4}-\d{2}$/.test(v.month||''))throw Error('--month YYYY-MM required');
  if(date(v['as-of'])<=new Date(Date.UTC(Number(v.month.slice(0,4)),Number(v.month.slice(5)),0)).toISOString().slice(0,10))throw Error('Archive only after month ends');
  const base=path.resolve(v.out),lock=path.join(base,`${v.month}-team.lock`);let fd;
  try{fd=fs.openSync(lock,'wx');}catch{throw Error('Another writer is active (or stale lock needs manual inspection)');}
  try {
  const current=JSON.parse(fs.readFileSync(path.join(base,`${v.month}-team.current.json`),'utf8'));
  const mf=JSON.parse(fs.readFileSync(safeFile(base,`${current.directory}/${current.manifest}`),'utf8'));
  const lastDay=new Date(Date.UTC(Number(v.month.slice(0,4)),Number(v.month.slice(5)),0)).toISOString().slice(0,10);
  if(mf.team!==c.team||mf.period.end!==lastDay)throw Error('Rebuild the full month before archiving');
  const archive=path.join(base,`${v.month}-team.archive.json`);
  fs.writeFileSync(archive,JSON.stringify(current,null,2)+'\n',{flag:'wx'});return {status:'archived',archive};
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
 }
 throw Error('Commands: approve, daily, weekly, monthly, archive, push-daily, push-weekly');
}
async function build(out,stem,c,result,period){
 const base=path.resolve(out);fs.mkdirSync(base,{recursive:true});
 if(fs.existsSync(path.join(base,stem+'.archive.json')))throw Error('Month is archived; use a separate output for corrections');
 const lock=path.join(base,stem+'.lock');let fd;
 try{fd=fs.openSync(lock,'wx');}catch{throw Error('Another writer is active (or stale lock needs manual inspection)');}
 const version=stem+'-'+crypto.randomUUID(),staging=path.join(base,'.staging-'+version),dest=path.join(base,version);
 try{
  if(fs.existsSync(path.join(base,stem+'.archive.json')))throw Error('Month is archived; use a separate output for corrections');
  const manifest=await render(staging,stem,c,result,period);fs.renameSync(staging,dest);
  const pointer={directory:version,pptx:stem+'.pptx',manifest:stem+'.manifest.json',source_fingerprint:manifest.source_fingerprint};
  atomic(path.join(base,stem+'.current.json'),JSON.stringify(pointer,null,2)+'\n');return {status:'generated',...pointer,slide_count:manifest.slide_count};
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);if(fs.existsSync(staging))fs.rmSync(staging,{recursive:true});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
