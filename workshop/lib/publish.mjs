import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readReport,safeFile} from './reports.mjs';
export function repositorySlug(remote){const m=remote.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);if(!m||m[1].split('/').some(x=>x==='.'||x==='..'))throw Error('Only exact github.com remotes supported');return m[1];}
export function publish({data,config:c,relative,confirmRepo,confirmMember,kind,run=execFileSync}){
  const git=(...args)=>run('git',['-C',data,...args],{encoding:'utf8'}).trim();
  const file=safeFile(data,relative),r=readReport(file,c);
  if(!r.approved||r.meta.member!==confirmMember||(r.meta.kind||'daily')!==kind)throw Error('Only reviewed matching author/kind can be published');
  if(kind==='weekly'){
    if(!Array.isArray(r.meta.source_records)||!r.meta.source_records.length)throw Error('Weekly source snapshots required');
    for(const source of r.meta.source_records){const current=readReport(safeFile(data,source.path),c);if(!current.approved||current.sha256!==source.sha256||current.meta.member!==r.meta.member)throw Error('Weekly sources changed; regenerate and review');}
  }
  const expected=kind==='daily'?`reports/daily/${r.meta.date}/${r.meta.member}.md`:`reports/weekly/${r.meta.period_start}_${r.meta.period_end}/${r.meta.member}.md`;
  if(relative!==expected)throw Error('Noncanonical report path');
  const fetchSlug=repositorySlug(git('remote','get-url','--all','origin'));
  const pushSlug=repositorySlug(git('remote','get-url','--push','--all','origin'));
  if(fetchSlug!==pushSlug||fetchSlug!==confirmRepo)throw Error('Explicit repository does not match fetch and push remotes');
  const info=JSON.parse(run('gh',['api',`repos/${confirmRepo}`],{encoding:'utf8'}));
  if(info.full_name!==confirmRepo||info.private!==true||info.archived||info.permissions?.push!==true)throw Error('Target must be verified private, writable and active');
  if(git('diff','--cached','--name-only'))throw Error('Staged changes exist; refusing to include unrelated files');
  const branch=git('symbolic-ref','--short','HEAD');if(!branch)throw Error('Detached HEAD unsupported');
  if(branch===info.default_branch)throw Error('Use a prepared member branch and PR review, not the default branch');
  // Do not publish pre-existing local commits or silently reconcile conflicts.
  git('fetch','origin',branch);
  if(git('rev-parse','HEAD')!==git('rev-parse',`origin/${branch}`))throw Error('Local branch must equal remote; sync separately first');
  git('add','--',relative);
  if(!git('diff','--cached','--name-only'))return {status:'unchanged',repository:confirmRepo};
  git('commit','-m',`report: ${kind} ${r.meta.member} ${r.meta.date}`);
  const commit=git('rev-parse','HEAD');
  git('push','origin',`HEAD:refs/heads/${branch}`);
  const remote=git('ls-remote','origin',`refs/heads/${branch}`).split(/\s/)[0];
  if(remote!==commit)throw Error('Push outcome uncertain; verify remote before retry');
  return {status:'pushed',repository:confirmRepo,commit};
}
