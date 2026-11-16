import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseDocument, stringify} from 'yaml';
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export function id(value) { if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value || '')) throw Error('Invalid team/member ID'); return value; }
export function date(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || new Date(value).toISOString().slice(0,10)!==value) throw Error('Invalid ISO date'); return value; }
export function safeFile(root, relative) {
  const base=fs.realpathSync(root), target=path.resolve(base,relative);
  if (!target.startsWith(base+path.sep)) throw Error('Path escapes data directory');
  let cur=base;
  for (const part of path.relative(base,target).split(path.sep)) {
    cur=path.join(cur,part);
    if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) throw Error('Symlinks are not allowed');
  }
  return target;
}
export function config(file) {
  const c=JSON.parse(fs.readFileSync(file,'utf8')); id(c.team);
  if (!Array.isArray(c.members)||!c.members.length||new Set(c.members).size!==c.members.length) throw Error('Unique members required');
  c.members.forEach(id); if(typeof c.timezone!=='string'||!c.timezone)throw Error('IANA timezone required'); new Intl.DateTimeFormat('en',{timeZone:c.timezone}).format();
  c.holidays??=[];c.leave??={};c.holidays.forEach(date);
  for(const [member,days] of Object.entries(c.leave)){if(!c.members.includes(member)||!Array.isArray(days))throw Error('Invalid leave calendar');days.forEach(date);}
  return c;
}
export function readReport(file,c) {
  const raw=fs.readFileSync(file,'utf8');const match=raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if(!match)throw Error('Expected YAML frontmatter and Markdown body');
  const doc=parseDocument(match[1],{uniqueKeys:true});if(doc.errors.length)throw Error(doc.errors[0].message);
  const meta=doc.toJS({maxAliasCount:0});
  if(!meta||meta.team!==c.team||!c.members.includes(meta.member)||meta.timezone!==c.timezone)throw Error('Team/member/timezone mismatch');
  date(meta.date);
  if(!['draft','approved'].includes(meta.status))throw Error('Invalid status');
  if(!Array.isArray(meta.items)||!meta.items.length)throw Error('At least one sourced item required');
  for(const item of meta.items){if(typeof item.text!=='string'||!item.text.trim()||typeof item.source!=='string'||!item.source.trim())throw Error('Every item needs text and source');if(item.text.length>4000||item.source.length>1000)throw Error('Item too long');}
  for(const field of ['blockers','next']){meta[field]??=[];if(!Array.isArray(meta[field])||meta[field].some(x=>typeof x!=='string'||x.length>4000))throw Error('Invalid '+field);}
  if(meta.kind && !['daily','weekly'].includes(meta.kind))throw Error('Invalid report kind');
  const {status,approved_by,approval_sha256,...facts}=meta;
  const checksum=digest(JSON.stringify(facts)+'\n'+match[2]);
  const approved=status==='approved'&&approved_by===meta.member&&approval_sha256===checksum;
  return {meta,body:match[2],checksum,approved,file,sha256:digest(raw)};
}
export function approve(file,c,member) {
  const r=readReport(file,c);if(member!==r.meta.member)throw Error('Confirm the report author explicitly');
  r.meta.status='approved';r.meta.approved_by=member;r.meta.approval_sha256=r.checksum;
  atomic(file,'---\n'+stringify(r.meta)+'---\n'+r.body);
}
export function atomic(file,contents) { fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(tmp,contents,{flag:'wx'});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);} }
export function days(start,end){date(start);date(end);if(start>end||Date.parse(end)-Date.parse(start)>370*864e5)throw Error('Invalid date range');const out=[];for(let d=new Date(start);d<=new Date(end);d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10));return out;}
export function collect(root,c,start,end) {
  const reports=[],coverage=[];
  for(const day of days(start,end))for(const member of c.members){
    const dow=new Date(day).getUTCDay();let status=c.holidays.includes(day)?'holiday':c.leave[member]?.includes(day)?'leave':[0,6].includes(dow)?'weekend':'missing';
    const relative=`reports/daily/${day}/${member}.md`,file=safeFile(root,relative);
    if(fs.existsSync(file)){
      const r=readReport(file,c);
      if(r.meta.member!==member||r.meta.date!==day||(r.meta.kind&&r.meta.kind!=='daily'))throw Error('Path metadata mismatch: '+relative);
      if(r.approved){status='approved';reports.push({...r,relative});}else status='unapproved';
    }
    coverage.push({date:day,member,status});
  }
  return {reports,coverage};
}
export function weeklyMarkdown(c,member,start,end,result) {
  const reports=result.reports.filter(x=>x.meta.member===member);
  const meta={kind:'weekly',team:c.team,member,date:end,timezone:c.timezone,status:'draft',period_start:start,period_end:end,source_records:reports.map(r=>({path:r.relative,sha256:r.sha256})),items:reports.flatMap(r=>r.meta.items.map(i=>({text:`${r.meta.date} ${i.text}`,source:`${r.relative}#sha256=${r.sha256}; ${i.source}`}))),blockers:reports.flatMap(r=>r.meta.blockers),next:reports.flatMap(r=>r.meta.next)};
  if(!meta.items.length)throw Error('No approved source reports; cannot create factual weekly report');
  return '---\n'+stringify(meta)+'---\n# 個人週報（草稿，請本人核對）\n\n'+result.coverage.filter(x=>x.member===member).map(x=>`- ${x.date}: ${x.status}`).join('\n')+'\n';
}
