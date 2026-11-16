import pptxgen from 'pptxgenjs';
import fs from 'node:fs';
import path from 'node:path';
import {atomic,digest} from './reports.mjs';
function slide(pptx,title,lines){
  // Paginate before shrinking. Bound line lengths so evidence URLs cannot overflow.
  const wrapped=lines.flatMap(line=>{const out=[];for(let i=0;i<line.length;i+=55)out.push(line.slice(i,i+55));return out.length?out:[''];});
  const pages=Math.max(1,Math.ceil(wrapped.length/12));
  for(let j=0;j<pages;j++){
    const s=pptx.addSlide();s.background={color:'FAF9F4'};
    s.addText(title+(pages>1?` (${j+1}/${pages})`:''),{x:.5,y:.3,w:12.3,h:.65,fontSize:28,color:'12343B',fontFace:'Noto Sans CJK TC',breakLine:false});
    s.addText(wrapped.slice(j*12,j*12+12).join('\n'),{x:.55,y:1.2,w:12.2,h:5.7,fontSize:18,color:'173F48',fontFace:'Noto Sans CJK TC',paraSpaceAfterPt:8});
  }
}
export async function render(output,stem,c,result,period){
  const pptx=new pptxgen();pptx.layout='LAYOUT_WIDE';pptx.author='Team reporting workshop';pptx.subject='Reviewed source records; not an independently verified performance assessment';
  slide(pptx,`${c.team} 團隊報告`,[`${period.start} 至 ${period.end}`,`時區：${c.timezone}`,`已核對日報 ${result.reports.length} 份`, '本檔是來源紀錄的確定性彙整，不推測完成率或績效。']);
  const missing=result.coverage.filter(x=>['missing','unapproved'].includes(x.status));
  slide(pptx,'缺漏與工作日狀態',result.coverage.map(x=>`${x.date}  ${x.member}  ${x.status}`));
  for(const r of result.reports)slide(pptx,`${r.meta.date} ${r.meta.member}`,r.meta.items.flatMap(i=>[i.text,`來源：${i.source}`]).concat(r.meta.blockers.map(x=>'阻礙：'+x),r.meta.next.map(x=>'下一步：'+x)));
  // Weekly sections derive from the same immutable daily snapshots, never assumed approved weekly submissions.
  const weeks=new Map();for(const r of result.reports){const d=new Date(r.meta.date);const n=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-n);const key=d.toISOString().slice(0,10)+' '+r.meta.member;if(!weeks.has(key))weeks.set(key,[]);weeks.get(key).push(r);}
  for(const [week,rs]of weeks)slide(pptx,`週彙整 ${week}`,rs.flatMap(r=>r.meta.items.map(i=>`${r.meta.date} ${i.text}`)));
  slide(pptx,'主管摘要（依來源彙整）',[`涵蓋 ${c.members.join('、')}`,`待補紀錄 ${missing.length} 筆`,...result.reports.flatMap(r=>r.meta.blockers.map(x=>`${r.meta.member}：${x}`)),'請依來源核對後再作管理決策。']);
  fs.mkdirSync(output,{recursive:true});const temp=path.join(output,stem+'.tmp.pptx');
  await pptx.writeFile({fileName:temp});const bytes=fs.readFileSync(temp);if(bytes.subarray(0,2).toString()!=='PK')throw Error('Invalid PPTX');
  const manifest={schema_version:1,team:c.team,timezone:c.timezone,period,config_sha256:digest(JSON.stringify(c)),source_fingerprint:digest(JSON.stringify(result.reports.map(r=>[r.relative,r.sha256]))),sources:result.reports.map(r=>({path:r.relative,sha256:r.sha256,member:r.meta.member,date:r.meta.date})),coverage:result.coverage,slide_count:pptx._slides.length,pptx_sha256:digest(bytes)};
  const summary=`# ${c.team} ${period.start} – ${period.end}\n\n已核對日報：${result.reports.length}；待補：${missing.length}\n\n`+result.reports.flatMap(r=>r.meta.items.map(i=>`- ${r.meta.date} ${r.meta.member}: ${i.text}\n  - 來源：${i.source} (${r.relative}, SHA256 ${r.sha256})`)).join('\n')+'\n';
  fs.renameSync(temp,path.join(output,stem+'.pptx'));
  atomic(path.join(output,stem+'.summary.md'),summary);atomic(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
