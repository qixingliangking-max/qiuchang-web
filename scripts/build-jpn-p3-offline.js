#!/usr/bin/env node
const fs=require("fs");
const path=require("path");

require("./p3-offline-builder-core.js");
if(typeof globalThis.buildP3Snapshot!=="function") throw new Error("buildP3Snapshot not loaded");

const root=path.resolve(__dirname,"..");
const rawDir=path.join(root,"internal-test","p3-candidates","raw");
const outDir=path.join(root,"internal-test","p3-candidates");
const contractPath=path.join(root,"internal-test","p3-data","P3_SCHEMA_CONTRACT_V5.json");

const raw={};
for(let i=1;i<=4;i++){
  const p=path.join(rawDir,`JPN_J1-2026-27-batch${i}.json`);
  Object.assign(raw,JSON.parse(fs.readFileSync(p,"utf8")));
}
const contract=JSON.parse(fs.readFileSync(contractPath,"utf8"));
const cfg={
  league_code:"JPN_J1",
  season:"2026/27",
  competition_id:"d6711104-90d0-458a-b9b2-5c1b5a9a37f3",
  version:"P3_V5_JPN_J1_PILOT",
  generated_at:new Date().toISOString()
};
const built=globalThis.buildP3Snapshot(raw,cfg);
const snapshot=built.snapshot;

const errors=[],warnings=[];
const isObj=v=>v&&typeof v==="object"&&!Array.isArray(v);
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const skip=new Set(Object.keys(contract.strict_shape_exceptions||{}));
function walk(node,p,team){
  if(skip.has(p)) return;
  if(Array.isArray(node)){
    const spec=contract.strict_row_shapes?.[p+"[]"];
    for(const row of node.filter(isObj)){
      if(spec){
        const actual=Object.keys(row).sort();
        if(!same(actual,spec)) errors.push({type:"STRICT_SHAPE_DRIFT",team,path:p+"[]",expected:spec,actual});
      }
      for(const [k,v] of Object.entries(row)) walk(v,p+"[]."+k,team);
    }
  } else if(isObj(node)){
    const spec=contract.strict_row_shapes?.[p];
    if(spec){
      const actual=Object.keys(node).sort();
      if(!same(actual,spec)) errors.push({type:"STRICT_SHAPE_DRIFT",team,path:p,expected:spec,actual});
    }
    for(const [k,v] of Object.entries(node)) walk(v,p+"."+k,team);
  }
}
const required=contract.required_team_blocks||[];
let depthRows=[];
for(const [team,t] of Object.entries(snapshot.teams)){
  walk(t,"team",team);
  const missing=required.filter(k=>Array.isArray(t[k])?t[k].length===0:!t[k]);
  if(missing.length) errors.push({type:"REQUIRED_BLOCK_MISSING",team,missing});
  const slots=(t.D_squad_depth||[]).reduce((s,d)=>s+Number(d.required_slots||0),0);
  if(slots!==11) errors.push({type:"REQUIRED_SLOTS_NOT_11",team,value:slots});
  for(const p of t.A_player_base||[]){
    if(Number(p.starts||0)>0 && p.primary_position==null)
      errors.push({type:"STARTER_PRIMARY_POSITION_NULL",team,player:p.player_name});
  }
  for(const p of t.B_player_performance||[]){
    if(p.performance_score==null && p.performance_confidence!=="UNTESTED")
      errors.push({type:"BAD_PERFORMANCE_NULL",team,player:p.player_name});
    if(p.performance_score!=null && p.performance_confidence==="UNTESTED")
      errors.push({type:"UNTESTED_WITH_SCORE",team,player:p.player_name});
  }
  for(const d of t.D_squad_depth||[]){
    depthRows.push(d);
    if((d.replacement_chain||[]).some(x=>x.availability_role==="OTHER_STARTER"||x.pool_type==="OTHER_STARTER"))
      errors.push({type:"OTHER_STARTER_IN_NORMAL_REPLACEMENT",team,position:d.position_code});
    if(["VALID","PARTIAL"].includes(d.data_status) &&
       ["position_depth_score","raw_replacement_gap","replacement_loss","replacement_quality","replacement_role_quality"].some(f=>d[f]==null))
      errors.push({type:"DEPTH_METRIC_MISSING",team,position:d.position_code,status:d.data_status});
  }
  if(t.sample_context?.sample_level==="LOW_SAMPLE"||t.sample_context?.usage_mode==="LIMITED")
    warnings.push({type:"LIMITED_SAMPLE",team,matches:t.sample_context?.team_matches});
}
const avgDepth=Object.values(snapshot.teams).reduce((s,t)=>s+Number(t.C_lineup_structure?.depth_data_coverage_pct||0),0)/Math.max(Object.keys(snapshot.teams).length,1);
const allFull=Object.values(snapshot.teams).every(t=>t.sample_context?.usage_mode==="FULL");
const quality=(allFull&&avgDepth>=70)?"PILOT_FULL":"LIMITED";
const statusDist={};
for(const d of depthRows) statusDist[d.data_status]=(statusDist[d.data_status]||0)+1;

const report={
  league_code:"JPN_J1",
  season:"2026/27",
  generated_at:new Date().toISOString(),
  teams:Object.keys(snapshot.teams).length,
  aggregate_players:built.meta.aggregate_players,
  gate_status:errors.length?"FAIL":"PASS",
  errors_count:errors.length,
  warnings_count:warnings.length,
  quality_tier:quality,
  avg_team_depth_coverage_pct:Math.round(avgDepth*10)/10,
  depth_rows:depthRows.length,
  status_distribution:statusDist,
  errors,
  warnings
};

fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,"JPN_J1-2026-27.json"),JSON.stringify(snapshot,null,2));
fs.writeFileSync(path.join(outDir,"JPN_J1-2026-27-gate.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
process.exit(errors.length?1:0);
