import fs from 'node:fs/promises';

const START=process.env.START_DATE || '2026-09-26';
const END=process.env.END_DATE || '2026-10-04';
const CONFIG=await fs.readFile('supabase-config.js','utf8');
const urlMatch=CONFIG.match(/QC_SUPABASE_URL\s*=\s*['"]([^'"]+)/);
const keyMatch=CONFIG.match(/QC_SUPABASE_PUBLISHABLE_KEY\s*=\s*['"]([^'"]+)/);
if(!urlMatch||!keyMatch) throw new Error('Supabase public config not found');
const BASE=urlMatch[1];
const KEY=keyMatch[1];

const headers={apikey:KEY,Authorization:'Bearer '+KEY};

async function rest(table,params={}){
  const u=new URL(BASE+'/rest/v1/'+table);
  for(const [k,v] of Object.entries(params)) u.searchParams.set(k,String(v));
  const res=await fetch(u,{headers});
  const text=await res.text();
  let body;
  try{body=text?JSON.parse(text):null;}catch{body=text}
  if(!res.ok){
    const err=new Error(table+' '+res.status+' '+String(text).slice(0,500));
    err.status=res.status; err.body=body; throw err;
  }
  return body;
}

function scoreOk(v){return /^\s*\d+\s*[-:：]\s*\d+\s*$/.test(String(v||''));}
function isoDates(start,end){
  const out=[]; let d=new Date(start+'T00:00:00Z'); const e=new Date(end+'T00:00:00Z');
  while(d<=e){out.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1);}
  return out;
}
function newestPerPool(rows){
  const map=new Map();
  for(const r of rows||[]){
    const key=String(r.pool_code||'');
    const prev=map.get(key);
    const t=Date.parse(r.captured_at||0), pt=Date.parse(prev?.captured_at||0);
    if(!prev || t>=pt) map.set(key,r);
  }
  return [...map.values()];
}

let predictionSnapshots=[];
try{
  predictionSnapshots=await rest('jc_overview_prediction_snapshots',{
    select:'business_date,payload,match_count,model_count,generated_at',
    business_date:'gte.'+START,
    and:'(business_date.lte.'+END+')',
    order:'business_date.asc'
  });
  console.log('Protected overview snapshots readable:',predictionSnapshots.length);
}catch(err){
  console.log('Protected overview snapshots not readable with publishable key; using locked-model fallback:',err.message);
}
const snapByDate=new Map((predictionSnapshots||[]).map(x=>[x.business_date,x]));

const matches=await rest('jc_matches',{
  select:'id,match_num,business_date,league_name,league_short_name,home_team_name,away_team_name,match_date,match_time,kickoff_at,match_status,raw',
  business_date:'gte.'+START,
  and:'(business_date.lte.'+END+')',
  order:'business_date.asc,match_num.asc',
  limit:'1000'
});
console.log('Matches read:',matches.length);

const ids=matches.map(x=>x.id);
let models=[],markets=[];
for(let i=0;i<ids.length;i+=60){
  const chunk=ids.slice(i,i+60).join(',');
  const mm=await rest('jc_model_outputs',{
    select:'id,jc_match_id,model_version,stage,direction,single_pick,handicap_direction,htft_top1,htft_top2,goal_range,top_scores,raw_input,is_current,is_locked,locked_at',
    jc_match_id:'in.('+chunk+')',
    is_locked:'eq.true',
    is_current:'eq.true',
    limit:'1000'
  });
  models.push(...mm);
  const ms=await rest('jc_prekick_latest_market_snapshots',{
    select:'jc_match_id,pool_code,goal_line,outcomes,captured_at,official_update_time',
    jc_match_id:'in.('+chunk+')',
    limit:'1000'
  });
  markets.push(...ms);
}
console.log('Locked models read:',models.length,'market rows:',markets.length);

const modelById=new Map(models.map(x=>[String(x.jc_match_id),x]));
const marketById=new Map();
for(const m of markets){
  const k=String(m.jc_match_id);
  if(!marketById.has(k)) marketById.set(k,[]);
  marketById.get(k).push(m);
}
const matchByDate=new Map();
for(const m of matches){
  if(!matchByDate.has(m.business_date)) matchByDate.set(m.business_date,[]);
  matchByDate.get(m.business_date).push(m);
}

const manifestPath='data/overview/manifest.json';
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.version=1; manifest.dates=manifest.dates||{};

const report=[];
for(const ds of isoDates(START,END)){
  const dayMatches=matchByDate.get(ds)||[];
  if(!dayMatches.length){
    report.push({date:ds,status:'NO_MATCHES'}); continue;
  }

  const original=snapByDate.get(ds);
  const originalRows=Array.isArray(original?.payload?.rows)?original.payload.rows:[];
  const originalById=new Map(originalRows.map(r=>[String(r.id),r]));
  const rows=[];
  let missingModel=0,missingScore=0;

  for(const m of dayMatches){
    let row=originalById.get(String(m.id));
    const model=modelById.get(String(m.id));
    // Legacy history freezes only the actual locked prediction set.
    // Schedule rows without a locked model are not part of the historical prediction page.
    if(!row && !model) continue;

    const ft=m.raw?.sectionsNo999;
    const ht=m.raw?.sectionsNo1;
    if(!scoreOk(ft)){missingScore++; continue;}

    if(row){
      row=structuredClone(row);
    }else{
      row={
        id:m.id,
        raw:{},
        match_num:m.match_num,
        kickoff_at:m.kickoff_at,
        match_date:m.match_date,
        match_time:m.match_time,
        league_name:m.league_name,
        match_status:m.match_status,
        business_date:m.business_date,
        away_team_name:m.away_team_name,
        home_team_name:m.home_team_name,
        league_short_name:m.league_short_name,
        jc_model_outputs:[model],
        jc_market_snapshots:newestPerPool(marketById.get(String(m.id))||[])
      };
    }

    row.raw={...(row.raw||{}),sectionsNo999:ft,sectionsNo1:ht||'',matchStatusName:'已结束'};
    row.match_status='已结束';
    row.jc_model_outputs=Array.isArray(row.jc_model_outputs)&&row.jc_model_outputs.length
      ? row.jc_model_outputs
      : (modelById.get(String(m.id))?[modelById.get(String(m.id))]:[]);
    row.jc_market_snapshots=Array.isArray(row.jc_market_snapshots)&&row.jc_market_snapshots.length
      ? row.jc_market_snapshots
      : newestPerPool(marketById.get(String(m.id))||[]);
    rows.push(row);
  }

  const expected=original?.match_count || originalRows.length || dayMatches.filter(m=>modelById.has(String(m.id))).length;
  const final=expected>0 && rows.length===expected && missingScore===0;
  if(!final){
    report.push({date:ds,status:'SKIPPED_INCOMPLETE',dayMatches:dayMatches.length,expected,rows:rows.length,missingScore,missingModel});
    continue;
  }

  rows.sort((a,b)=>String(a.match_num||'').localeCompare(String(b.match_num||''),'zh-CN',{numeric:true}));
  const file='data/overview/'+ds+'.history.v1.json';
  const payload={
    version:1,business_date:ds,frozen:true,
    frozen_at:new Date().toISOString(),
    source:'legacy_history_backfill_20261006',
    rows
  };
  await fs.writeFile(file,JSON.stringify(payload));
  manifest.dates[ds]=file;
  report.push({date:ds,status:'FROZEN',rows:rows.length,file});
}

manifest.updated_at=new Date().toISOString();
const sorted=Object.fromEntries(Object.entries(manifest.dates).sort(([a],[b])=>a.localeCompare(b)));
manifest.dates=sorted;
await fs.writeFile(manifestPath,JSON.stringify(manifest));
await fs.writeFile('data/overview/BACKFILL_20260926_20261004_REPORT.json',JSON.stringify({start:START,end:END,generated_at:new Date().toISOString(),report},null,2));
console.log(JSON.stringify(report,null,2));
if(report.some(x=>x.status==='SKIPPED_INCOMPLETE')) process.exitCode=2;
