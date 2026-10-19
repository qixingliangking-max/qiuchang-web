"use strict";
/**
 * QCDA | V1.0-R1 RETROSPECTIVE EXPERIMENT, selection only.
 * Never import final/half-time scores in this module.
 * Exactly reproduce V1.0 archived direction and score_2 selection on
 * Oct 5-18, gate them with the user-requested NEW minimum winning payout;
 * all other samples use frozen-model pregame heuristics, distinct version R1.
 * Historic R1 is not a claim of a real-world or out-of-sample strategy.
 */
const R=require("./v1r1_project_rules.cjs");
const VERSION="CURATED_V1_0_R1_REPLAY_0923_1019";
const IDS=R.PROJECTS.map(p=>p.id);
const KEYS={h:"胜",d:"平",a:"负"};
function n(v){return Number(v)}
function at(v){return Date.parse(v)}
function fixed(v){return Math.round(v*1e6)/1e6}
function selectSide(txt){
 const s=String(txt??"");
 const k=(s.match(/[胜平负]/g)||[]);
 return k.length===1?({胜:"h",平:"d",负:"a"})[k[0]]:null;
}
function htKey(txt){
 const s=String(txt??"").match(/[胜平负]\s*[\/／]\s*[胜平负]/);
 if(!s)return null;
 const chars=s[0].match(/[胜平负]/g),m={胜:"h",平:"d",负:"a"};
 return m[chars[0]]+m[chars[1]];
}
function scoreKey(txt){
 const match=String(txt??"").match(/^(\d+)[-:：](\d+)$/);
 return match?"s"+String(+match[1]).padStart(2,"0")+"s"+String(+match[2]).padStart(2,"0"):null;
}
function impliedOddsPool(odds){const all=Object.values(odds||{}).filter(x=>n(x)>1).map(x=>1/n(x));return all.reduce((a,b)=>a+b,0)}
function modelTime(x){return Math.max(at(x?.createdAt),at(x?.updatedAt),at(x?.lockedAt))}
function makeLeg(f,market,choices,weight,reason){
 const snap=f.markets?.[market];const mt=modelTime(f.prematch_model);
 const capt=at(snap?.capturedAt);
 if(!Number.isFinite(capt)||!Number.isFinite(mt)||mt>=at(f.kickoff_at)||capt>=at(f.kickoff_at))return null;
 const unique=new Set(choices.map(p=>p.key));
 if(choices.length!==unique.size||choices.some(p=>!(n(p.odd)>1)))return null;
 return {fixtureId:f.id,day:f.business_day,num:f.match_num,home:f.home_team_name,
 away:f.away_team_name,league:f.league_name,kickoffAt:f.kickoff_at,
 marketAt:snap.capturedAt,market,choices,sourceReadyAt:new Date(Math.max(mt,capt)).toISOString(),
 heuristicCoverage:fixed(weight),rationale:reason,source:"ASOF_MODEL_AND_MARKET"};
}
function candidates(f,project){
 const mo=f.prematch_model;if(!mo)return [];
 const z=[];
 if(project==="direction"){
  const odd=f.markets?.had?.odds;
  const side=selectSide(mo.singlePick);
  if(side&&odd&&n(odd[side])>1){
   const p=1/n(odd[side])/impliedOddsPool(odd);
   const a=makeLeg(f,"had",[{key:side,label:KEYS[side],odd:n(odd[side])}],p,
     "赛前锁板TEST单选与普通胜平负赔率匹配");if(a)z.push(a);
  }else if(!odd){
   const h=f.markets?.hhad?.odds,allowed=(String(mo.handicapDirection||"").match(/让[胜平负]/g)||[]).map(s=>selectSide(s));
   for(const side of new Set(allowed)){
    if(side&&n(h?.[side])>1){const p=1/n(h[side])/impliedOddsPool(h);
      const a=makeLeg(f,"hhad",[{key:side,label:"让"+KEYS[side],odd:n(h[side])}],p*.98,"无普通胜平负：让球保护方向匹配");if(a)z.push(a);}
   }
  }
 }else if(project==="htft"){
  const odd=f.markets?.hafu?.odds,pool=impliedOddsPool(odd);
  for(const [idx,s] of [mo.htft1,mo.htft2].entries()){
   const k=htKey(s);if(!k||!(n(odd?.[k])>1)||!pool)continue;
   const a=makeLeg(f,"hafu",[{key:k,label:s,odd:n(odd[k])}],
    (1/n(odd[k])/pool)*(idx===0?1.06:1),"锁板半全场TOP2内独立择一；单场单选");if(a)z.push(a);
  }
 }else if(project==="goals"){
  const o=f.markets?.ttg?.odds,pool=impliedOddsPool(o);
  if(!pool)return [];
  const hint=new Set((String(mo.goalRange||"").match(/[0-7]\s*球/g)||[]).map(s=>s.match(/\d/)[0]));
  const possible=Object.entries(o).filter(([k,v])=>/^s[0-7]$/.test(k)&&n(v)>1&&n(v)>=3.60);
  for(let i=0;i<possible.length;i++)for(let j=i+1;j<possible.length;j++){
   const [ka,oa]=possible[i],[kb,ob]=possible[j];
   const value=(1/n(oa)*(hint.has(ka[1])?1.05:1)+1/n(ob)*(hint.has(kb[1])?1.05:1))/pool;
   const a=makeLeg(f,"ttg",[{key:ka,label:ka.slice(1)+"球",odd:n(oa)},
      {key:kb,label:kb.slice(1)+"球",odd:n(ob)}],value,"单场全部进球数赔率中挑两个，赛前进球区间仅软参考");
   if(a)z.push(a);
  }
 }else if(project==="score_2"||project==="score_3"){
  const scores=mo.topScores,odds=f.markets?.crs?.odds;
  if(!Array.isArray(scores)||scores.length<3||!odds)return [];
  const ps=scores.slice(0,3).map(s=>({key:scoreKey(s),label:s,odd:n(odds[scoreKey(s)])}));
  if(ps.some(p=>!p.key||!(p.odd>1)))return [];
  const coverage=ps.reduce((v,p,i)=>v+1/p.odd*(i===0?1.04:i===1?1:.98),0);
  const a=makeLeg(f,"crs",ps,coverage,"原版TOP3路径，赛前正确比分赔率确认");
  if(a)z.push(a);
 }
 return z;
}
function legacyEntry(raw,date,id){
 const cat=id==="direction"?"direction":"score";
 const entry=raw?.days?.[date]?.entries?.find(p=>p.type===cat);
 if(!entry)return {status:"ABSTAIN",reason:"ARCHIVED_V1_NO_ENTRY"};
 const legs=entry.legs.map((l,i)=>{
  const marketAt=l.row.mk[l.market]?.captured;
  return {fixtureId:date+"|"+l.row.num,day:date,num:l.row.num,
   home:l.row.h,away:l.row.a,league:l.row.league,kickoffAt:l.row.ko,
   marketAt,market:l.market,
   choices:l.picks.map(p=>({key:p.key,label:p.name,odd:n(l.row.mk[l.market]?.o?.[p.key])})),
   sourceReadyAt:marketAt,rationale:"原V1.0赛果遮挡冻结选择（不重排）",source:"ARCHIVED_V1_FROZEN"};
 });
 const selectedAt=new Date(Math.max(...legs.map(l=>at(l.sourceReadyAt)))+1000).toISOString();
 const plan={project:id,budget:1000,selectedAt,legs};
 try{
  const v=R.branches(plan);
  if(!v.qualified)return {status:"ABSTAIN",reason:"ORIGINAL_V1_BELOW_CURRENT_MIN_RETURN",legacyMinPayout:v.minimumPayout};
  return {status:"FROZEN",mode:"ORIGINAL_V1_FROZEN",plan,
   metrics:{tickets:v.branchCount,minReturn:v.minimumPayout,maxReturn:v.highestPayout,heuristicConfidence:null}};
 }catch(e){return {status:"ABSTAIN",reason:"ORIGINAL_V1_NON_PREMATCH_COMBINATION_OR_INVALID",details:String(e)}}
}
function rankGroup(legs,project){
 const cfg=R.getProject(project);
 const sourceReady=Math.max(...legs.map(l=>at(l.sourceReadyAt)));
 const kickoff=Math.min(...legs.map(l=>at(l.kickoffAt)));
 if(!(sourceReady<kickoff))return null; 
 const selectedAt=new Date(sourceReady+1000).toISOString();
 const plan={project,budget:1000,selectedAt,legs:legs.map(l=>({fixtureId:l.fixtureId,
  kickoffAt:l.kickoffAt,marketAt:l.marketAt,market:l.market,choices:l.choices}))};
 try{
 const b=R.branches(plan);
 if(!b.qualified)return null;
 return {status:"FROZEN",mode:"R1_ASOF_HEURISTIC",plan,
  legRecords:legs.map(l=>({num:l.num,home:l.home,away:l.away,
   confidence:l.heuristicCoverage,rationale:l.rationale,source:l.source})),
  metrics:{tickets:b.branchCount,minReturn:b.minimumPayout,maxReturn:b.highestPayout,
   heuristicConfidence:fixed(legs.reduce((v,l)=>v*l.heuristicCoverage,1))}};
 }catch(e){return null}
}
function freshSelect(fixtures,project){
 const cfg=R.getProject(project),legs=fixtures.flatMap(f=>candidates(f,project));
 if(!legs.length)return {status:"ABSTAIN",reason:"NO_PREMATCH_CANDIDATES"};
 // Each role separately selects highest estimated coverage, subject to min payout;
 // no use of real scores or published profit.
 const pool=legs.sort((a,b)=>b.heuristicCoverage-a.heuristicCoverage).slice(0,project==="goals"?90:75);
 let best=null,attempts=0;
 function rec(from,chosen){
  if(chosen.length===cfg.legs){
   if(new Set(chosen.map(c=>c.fixtureId)).size!==cfg.legs)return;
   attempts++;const out=rankGroup(chosen,project);if(!out)return;
   if(!best||out.metrics.heuristicConfidence>best.metrics.heuristicConfidence+1e-9||
       (Math.abs(out.metrics.heuristicConfidence-best.metrics.heuristicConfidence)<1e-9&&
         out.metrics.minReturn>best.metrics.minReturn))best=out;
   return;
  }
  for(let i=from;i<pool.length;i++){
   if(chosen.some(x=>x.fixtureId===pool[i].fixtureId))continue;
   rec(i+1,[...chosen,pool[i]]);
  }
 }
 rec(0,[]);
 return best||{status:"ABSTAIN",reason:"NO_GROUP_PASSED_RETURN_AND_PREMATCH_CHECK",candidateLegs:legs.length,groupsExamined:attempts};
}
function run(fixtures,original){
 if(original?.version!=="BLIND_SELECTOR_V1_20261005_18")throw Error("ORIGINAL_V1_EXPECTED");
 const all={};let total=0,archived=0;
 for(let date=new Date("2026-09-23T00:00:00Z");date<=new Date("2026-10-19T00:00:00Z");date.setUTCDate(date.getUTCDate()+1)){
  const day=date.toISOString().slice(0,10),ff=fixtures.filter(f=>f.business_day===day);
  const outcome={fixtures:ff.length,eligibleModels:ff.filter(f=>f.prematch_model).length,
   roles:{}};
  for(const id of IDS){
   const historical=(day>="2026-10-05"&&day<="2026-10-18"&&["direction","score_2"].includes(id));
   const pick=!ff.length?{status:"NO_FIXTURES"}:historical?legacyEntry(original,day,id):freshSelect(ff,id);
   outcome.roles[id]=pick;
   if(pick.status==="FROZEN"){total++;if(pick.mode==="ORIGINAL_V1_FROZEN")archived++;}
  }
  all[day]=outcome;
 }
 return {version:VERSION,inputScope:["2026-09-23","2026-10-19"],roleCount:4,
  projectIds:IDS,originalSelectionSha:R.ORIGINAL_SELECTION_SHA,
  limitations:["Retrospective R1 heuristics not exact V1.0 implementation","Old V1.0 direction/score_2 frozen entries reused Oct5-18 and rejected when today's floor or portfolio timing does not pass",
  "Selected-at coherence checked before earliest kickoff of each group","Selection input contains zero match-result fields","No source matches Oct1-4","Odds imply imperfect, uncalibrated likelihoods","This is not independent out-of-sample validation"],
  totalFrozen:total,archivedFrozen:archived,days:all};
}
module.exports={VERSION,run,candidates,legacyEntry,freshSelect};
