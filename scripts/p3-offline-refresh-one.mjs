#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const configPath=process.argv[2];
if(!configPath){
  console.error('Usage: node scripts/p3-offline-refresh-one.mjs <config.json>');
  process.exit(2);
}
const cfg=JSON.parse(fs.readFileSync(configPath,'utf8'));
const league=cfg.league_code;
const season=cfg.season;
const slugSeason=season.replaceAll('/','-');
const inputPath=path.join('internal-test','p3-inputs',league+'-'+slugSeason+'.json');
const candidatePath=path.join('internal-test','p3-candidates',league+'-'+slugSeason+'.json');
const gatePath=path.join('internal-test','p3-candidates',league+'-'+slugSeason+'-gate.json');
const publishedPath=path.join('internal-test','p3-data',league+'-'+slugSeason+'.json');
const manifestPath=path.join('internal-test','p3-data','P3_PROMOTION_MANIFEST.json');
const reportPath=path.join('internal-test','p3-refresh',league+'-'+slugSeason+'-last-run.json');

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function fetchJson(url){
  let last;
  for(let i=1;i<=3;i++){
    try{
      const res=await fetch(url,{headers:{
        'accept':'application/json,text/plain,*/*',
        'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129 Safari/537.36',
        'referer':'https://www.fotmob.com/'
      }});
      if(!res.ok) throw new Error('HTTP_'+res.status);
      return await res.json();
    }catch(e){
      last=e;
      if(i<3) await sleep(800*i);
    }
  }
  throw last;
}
function blobSha(buf){
  const head=Buffer.from('blob '+buf.length+'\0');
  return crypto.createHash('sha1').update(head).update(buf).digest('hex');
}

const all=new Map();
for(const leagueId of cfg.fotmob_league_ids||[]){
  const url='https://www.fotmob.com/api/data/leagues?id='+encodeURIComponent(leagueId)+
    '&ccode3='+encodeURIComponent(cfg.fotmob_ccode3)+
    '&season='+encodeURIComponent(season);
  const data=await fetchJson(url);
  const fixtures=data?.fixtures?.allMatches;
  if(!Array.isArray(fixtures)) throw new Error('fixtures.allMatches missing for '+leagueId);
  for(const m of fixtures){
    if(m?.id==null) continue;
    all.set(String(m.id),m);
  }
}

const finished=[...all.values()].filter(m=>m?.status?.finished===true);
const unmapped=[];
const matches=[];
for(const m of finished){
  const homeSource=m?.home?.name;
  const awaySource=m?.away?.name;
  const home=cfg.team_map?.[homeSource];
  const away=cfg.team_map?.[awaySource];
  if(!home || !away){
    unmapped.push({source_match_id:String(m.id),home_source:homeSource,away_source:awaySource,home_mapped:home||null,away_mapped:away||null});
    continue;
  }
  const kickoff=m?.status?.utcTime||null;
  matches.push({
    source_match_id:String(m.id),
    match_id:'fotmob:'+String(m.id),
    home_team:home,
    away_team:away,
    match_date:kickoff?String(kickoff).slice(0,10):null,
    kickoff_at:kickoff
  });
}
matches.sort((a,b)=>String(a.kickoff_at||a.match_date||'').localeCompare(String(b.kickoff_at||b.match_date||''))||a.source_match_id.localeCompare(b.source_match_id));

let previousIds=[];
if(fs.existsSync(inputPath)){
  try{
    const prev=JSON.parse(fs.readFileSync(inputPath,'utf8'));
    previousIds=(prev.matches||[]).map(x=>String(x.source_match_id)).sort();
  }catch{}
}
const currentIds=matches.map(x=>String(x.source_match_id)).sort();
const previousSet=new Set(previousIds);
const currentSet=new Set(currentIds);
const addedIds=currentIds.filter(x=>!previousSet.has(x));
const removedIds=previousIds.filter(x=>!currentSet.has(x));
const baseline=previousIds.length || Number(cfg.baseline_finished_matches||0);
const report={
  league_code:league,
  season,
  run_at:new Date().toISOString(),
  discovered_fixtures:all.size,
  discovered_finished:finished.length,
  baseline_finished_matches:baseline,
  new_finished_matches:addedIds.length,
  added_source_match_ids:addedIds,
  removed_source_match_ids:removedIds,
  mapped_finished:matches.length,
  unmapped_count:unmapped.length,
  unmapped,
  status:'DISCOVERED'
};
fs.mkdirSync(path.dirname(reportPath),{recursive:true});

if(unmapped.length){
  report.status='BLOCKED_UNMAPPED_TEAM';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.error(JSON.stringify(report,null,2));
  process.exit(3);
}
if(removedIds.length){
  report.status='BLOCKED_FINISHED_SET_REGRESSION';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.error(JSON.stringify(report,null,2));
  process.exit(4);
}
if(previousIds.length && addedIds.length===0){
  report.status='NO_NEW_FINISHED';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  process.exit(0);
}

const input={
  league_code:league,
  competition_id:cfg.competition_id,
  season,
  matches
};
fs.mkdirSync(path.dirname(inputPath),{recursive:true});
fs.writeFileSync(inputPath,JSON.stringify(input,null,2)+'\n');

const build=spawnSync(process.execPath,['scripts/p3-offline-collect-and-build.mjs',inputPath],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
process.stdout.write(build.stdout||'');
process.stderr.write(build.stderr||'');
if(build.status!==0){
  report.status='BUILD_FAILED';
  report.build_exit=build.status;
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  process.exit(build.status||5);
}

const gate=JSON.parse(fs.readFileSync(gatePath,'utf8'));
report.gate_status=gate.gate_status;
report.collection_coverage_pct=gate.collection_coverage_pct;
report.strict_errors=(gate.strict_errors||[]).length;
report.collection_failures=(gate.collection_failures||[]).length;
report.quality_tier=gate.quality_tier;
report.avg_team_depth_coverage_pct=gate.avg_team_depth_coverage_pct;

if(gate.gate_status!=='PASS' || Number(gate.collection_coverage_pct)!==100 || report.strict_errors!==0 || report.collection_failures!==0){
  report.status='GATE_FAILED_OLD_PROMOTION_KEPT';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.error(JSON.stringify(report,null,2));
  process.exit(6);
}

const candidate=fs.readFileSync(candidatePath);
fs.writeFileSync(publishedPath,candidate);
const sha=blobSha(candidate);
report.published_blob_sha=sha;
report.status='PROMOTED';

cfg.baseline_finished_matches=finished.length;
cfg.last_successful_refresh_at=report.run_at;
cfg.last_published_blob_sha=sha;
fs.writeFileSync(configPath,JSON.stringify(cfg,null,2)+'\n');

if(fs.existsSync(manifestPath)){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const row=(manifest.promoted||[]).find(x=>x.league_code===league && x.season===season);
  if(row){
    row.blob_sha=sha;
    row.gate_status='PASS';
    row.quality_tier=gate.quality_tier;
    row.avg_team_depth_coverage_pct=gate.avg_team_depth_coverage_pct;
    row.gate_report=gatePath;
    row.last_incremental_refresh_at=report.run_at;
    row.finished_matches=finished.length;
    row.build_mode='P3_SAFE_BUILD_R2_GITHUB_ACTIONS_INCREMENTAL';
  }
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
