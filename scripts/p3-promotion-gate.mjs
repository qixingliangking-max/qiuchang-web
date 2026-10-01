#!/usr/bin/env node
// P3 upstream promotion gate. This is intentionally independent of the browser renderer.
// Usage: node scripts/p3-promotion-gate.mjs <candidate.json> <contract.json>

import fs from 'node:fs';

const [candidatePath, contractPath='internal-test/p3-data/P3_SCHEMA_CONTRACT_V5.json'] = process.argv.slice(2);
if (!candidatePath) {
  console.error('Usage: node scripts/p3-promotion-gate.mjs <candidate.json> [contract.json]');
  process.exit(2);
}

const snapshot=JSON.parse(fs.readFileSync(candidatePath,'utf8'));
const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));

const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=arr=>[...new Set(arr.flatMap(x=>isObj(x)?Object.keys(x):[]))].sort();
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const REQUIRED=contract.required_team_blocks||[];
const SHAPES=contract.strict_row_shapes||{};
const SKIP=new Set(Object.keys(contract.strict_shape_exceptions||{}));

function schemaOf(s){
  const teams=Object.values(s?.teams||{});
  return {
    top_level:keys(teams),
    identity:keys(teams.map(t=>t.identity)),
    sample_context:keys(teams.map(t=>t.sample_context)),
    A_player_base:keys(teams.flatMap(t=>t.A_player_base||[])),
    B_player_performance:keys(teams.flatMap(t=>t.B_player_performance||[])),
    C_lineup_structure:keys(teams.map(t=>t.C_lineup_structure)),
    D_squad_depth:keys(teams.flatMap(t=>t.D_squad_depth||[])),
    D_primary_unit_item:keys(teams.flatMap(t=>(t.D_squad_depth||[]).flatMap(d=>d.primary_unit||[]))),
    D_replacement_chain_item:keys(teams.flatMap(t=>(t.D_squad_depth||[]).flatMap(d=>d.replacement_chain||[]))),
    D_emergency_shift_item:keys(teams.flatMap(t=>(t.D_squad_depth||[]).flatMap(d=>d.emergency_shift_options||[]))),
    D_absence_scenario_item:keys(teams.flatMap(t=>(t.D_squad_depth||[]).flatMap(d=>d.absence_scenarios||[]))),
    E_availability_impact:keys(teams.map(t=>t.E_availability_impact)),
    model_factors:keys(teams.map(t=>t.model_factors))
  };
}

function strictWalk(node,path,errors,context){
  if(SKIP.has(path)) return;
  if(Array.isArray(node)){
    const spec=SHAPES[path+'[]'];
    for(const row of node.filter(isObj)){
      if(spec){
        const actual=Object.keys(row).sort();
        if(!same(actual,spec)) errors.push({type:'STRICT_SHAPE_DRIFT',path:path+'[]',context,expected:spec,actual});
      }
      for(const [k,v] of Object.entries(row)) strictWalk(v,path+'[].'+k,errors,context);
    }
  }else if(isObj(node)){
    const spec=SHAPES[path];
    if(spec){
      const actual=Object.keys(node).sort();
      if(!same(actual,spec)) errors.push({type:'STRICT_SHAPE_DRIFT',path,context,expected:spec,actual});
    }
    for(const [k,v] of Object.entries(node)) strictWalk(v,path+'.'+k,errors,context);
  }
}

function validate(s){
  const teams=Object.values(s?.teams||{});
  const errors=[],warnings=[];
  const union=contract.schemas||{};
  const schema=schemaOf(s);

  for(const k of Object.keys(union)){
    if(!same(schema[k],union[k])) errors.push({type:'SCHEMA_DRIFT',bucket:k,expected:union[k],actual:schema[k]});
  }

  for(const t of teams){
    const name=t?.identity?.team_name||'?';
    strictWalk(t,'team',errors,{team:name});

    const missing=REQUIRED.filter(k=>Array.isArray(t[k])?t[k].length===0:!t[k]);
    if(missing.length) errors.push({type:'REQUIRED_BLOCK_MISSING',team:name,missing});

    const slots=(t.D_squad_depth||[]).reduce((sum,d)=>sum+Number(d.required_slots||0),0);
    if(slots!==11) errors.push({type:'REQUIRED_SLOTS_NOT_11',team:name,value:slots});

    for(const d of t.D_squad_depth||[]){
      if((d.replacement_chain||[]).some(x=>String(x.availability_role||x.pool_type||'')==='OTHER_STARTER')){
        errors.push({type:'OTHER_STARTER_IN_NORMAL_REPLACEMENT',team:name,position:d.position_code});
      }
      if(['VALID','PARTIAL'].includes(String(d.data_status)) &&
        ['position_depth_score','raw_replacement_gap','replacement_loss','replacement_quality','replacement_role_quality'].some(f=>d[f]==null)){
        errors.push({type:'DEPTH_METRIC_MISSING',team:name,position:d.position_code,status:d.data_status});
      }
    }

    const aById=new Map((t.A_player_base||[]).map(a=>[String(a.player_id),a]));
    for(const p of t.B_player_performance||[]){
      const a=aById.get(String(p.player_id))||{};
      const minutes=Number(a.minutes||0);
      const starts=Number(a.starts||0);
      if(p.performance_score==null && (minutes>0 || String(p.performance_confidence)!=='UNTESTED')){
        errors.push({type:'BAD_PERFORMANCE_NULL',team:name,player:p.player_name,minutes});
      }
      if(p.performance_score!=null && String(p.performance_confidence)==='UNTESTED'){
        errors.push({type:'UNTESTED_WITH_SCORE',team:name,player:p.player_name});
      }
      if(p.primary_position==null && starts>0){
        errors.push({type:'STARTER_POSITION_NULL',team:name,player:p.player_name,starts});
      }
    }

    if(t?.sample_context?.sample_level==='LOW_SAMPLE'||t?.sample_context?.usage_mode==='LIMITED'){
      warnings.push({type:'LIMITED_SAMPLE',team:name,matches:t?.C_lineup_structure?.squad_matches||t?.sample_context?.team_matches});
    }
  }

  return {ok:errors.length===0,errors,warnings,teams:teams.length,contract:contract.contract};
}

const result=validate(snapshot);
process.stdout.write(JSON.stringify(result,null,2)+'\n');
process.exit(result.ok?0:1);
