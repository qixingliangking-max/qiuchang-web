#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir=path.join('internal-test','p3-refresh');
const configs=fs.readdirSync(dir)
  .filter(name=>/^[A-Z0-9_]+-(?:\d{4}|\d{4}-\d{2})\.json$/.test(name))
  .sort();

const results=[];
for(const name of configs){
  const configPath=path.join(dir,name);
  console.log('\n[P3-REFRESH] start',name);
  const run=spawnSync(process.execPath,['scripts/p3-offline-refresh-one.mjs',configPath],{
    encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
  if(run.stdout) process.stdout.write(run.stdout);
  if(run.stderr) process.stderr.write(run.stderr);

  const reportPath=configPath.replace(/\.json$/,'-last-run.json');
  let report={league_code:name,status:'REPORT_MISSING'};
  if(fs.existsSync(reportPath)){
    try{ report=JSON.parse(fs.readFileSync(reportPath,'utf8')); }catch{}
  }
  results.push({
    league_code:report.league_code||name,
    season:report.season||null,
    status:report.status||'UNKNOWN',
    discovered_finished:report.discovered_finished??null,
    baseline_finished_matches:report.baseline_finished_matches??null,
    new_finished_matches:report.new_finished_matches??null,
    gate_status:report.gate_status??null,
    collection_coverage_pct:report.collection_coverage_pct??null,
    unmapped_count:report.unmapped_count??null,
    strict_errors:report.strict_errors??null,
    collection_failures:report.collection_failures??null,
    exit_code:run.status??0
  });

  // Gentle spacing between leagues; no need to hammer FotMob.
  await new Promise(resolve=>setTimeout(resolve,1000));
}

const blocked=results.filter(x=>!['PROMOTED','NO_NEW_FINISHED'].includes(x.status));
const promoted=results.filter(x=>x.status==='PROMOTED');
const noops=results.filter(x=>x.status==='NO_NEW_FINISHED');
const summary={
  run_at:new Date().toISOString(),
  schedule_policy:'08:30 + 23:30 Asia/Shanghai',
  total_leagues:results.length,
  promoted_leagues:promoted.length,
  noop_leagues:noops.length,
  blocked_leagues:blocked.length,
  results
};
fs.writeFileSync(path.join(dir,'P3_REFRESH_LAST_RUN.json'),JSON.stringify(summary,null,2)+'\n');
console.log('\n[P3-REFRESH] summary',JSON.stringify({
  total:summary.total_leagues,
  promoted:summary.promoted_leagues,
  noop:summary.noop_leagues,
  blocked:summary.blocked_leagues
}));
process.exit(0);
