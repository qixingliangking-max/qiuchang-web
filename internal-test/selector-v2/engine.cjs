/* QCDA AI Curator V2.0 — independent pre-match probabilities and portfolio gate.
 * Research-only until prospective calibration; no network/DB access or settlement imports.
 * Inputs must be point-in-time frozen before an actual selection decision.
 */
"use strict";
const PAIRS=[["direction",2,1],["htft",2,1],["goals",2,2],["score2x2",2,2],["score2x3",2,3],["score3x3",3,3]];
const POOL={direction:["had","hhad"],htft:["hafu"],goals:["ttg"],score2x2:["crs"],score2x3:["crs"],score3x3:["crs"]};
const MAX=12;
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function numeric(x){const n=Number(x);return Number.isFinite(n)?n:null}
function utc(t){const v=Date.parse(t||"");return Number.isFinite(v)?v:null}
function poisson(lambda){let values=[Math.exp(-lambda)];for(let i=1;i<=MAX;i++)values.push(values[i-1]*lambda/i);
 const sum=values.reduce((a,b)=>a+b,0);return values.map(x=>x/sum);}
function side(a,b){return a>b?"h":a<b?"a":"d"}
function scoreMarketKey(a,b){return "s"+String(a).padStart(2,"0")+"s"+String(b).padStart(2,"0")}
function targetKeys(text){const m=String(text||"").match(/(\d+)\+?\s*球/g)||[];const n=m.map(t=>Math.min(7,Number(t.match(/\d+/)[0])));
 if(n.length<2){const r=String(text||"").match(/^(\d+)\s*[—–-]\s*(\d+)\s*球$/);if(r)for(let i=+r[1];i<=Math.min(+r[2],7);i++)n.push(i)}
 return [...new Set(n)].map(v=>"s"+v);
}
function pathKey(s){const [a,b]=String(s||"").split("/");const map={"胜":"h","平":"d","负":"a"};return map[a]&&map[b]?map[a]+map[b]:null}
function asOfEvidence(fixture){
 if(!fixture||typeof fixture!=="object")return {ok:false,code:"INPUT_MISSING"};
 // Outcome and settlement fields are not even permitted in the selection input.
 for(const key of ["ft","ht","finalScore","halfScore","settlement","isHit","actualResult","completedAt"]){
  if(Object.prototype.hasOwnProperty.call(fixture,key))return {ok:false,code:"OUTCOME_FIELD_FORBIDDEN",field:key};
 }
 const start=utc(fixture.kickoffAt),at=utc(fixture.decisionAt),lock=utc(fixture.model?.lockedAt),edit=utc(fixture.model?.updatedAt);
 const captured=utc(fixture.features?.capturedAt);
 if([start,at,lock,edit,captured].some(x=>x===null))return {ok:false,code:"TIMESTAMP_MISSING"};
 if(!(lock<=at&&edit<=at&&captured<=at&&at<start))return {ok:false,code:"ASOF_LEAK_OR_UNLOCKED"};
 for(const [key,market] of Object.entries(fixture.markets||{})){
  const d=utc(market.capturedAt);
  if(d===null||d>at)return {ok:false,code:"MARKET_AFTER_DECISION",market:key};
 }
 if(!fixture.model?.isLocked)return {ok:false,code:"MODEL_NOT_LOCKED"};
 const st=fixture.features;
 const required=["homeGoalsFor","homeGoalsAgainst","awayGoalsFor","awayGoalsAgainst","homeSample","awaySample"];
 if(required.some(k=>numeric(st[k])===null))return {ok:false,code:"STAT_REQUIRED"};
 if(st.homeSample<6||st.awaySample<6)return {ok:false,code:"SAMPLE_TOO_SMALL"};
 if(required.slice(0,4).some(k=>numeric(st[k])<0))return {ok:false,code:"INVALID_GOAL_RATE"};
 return {ok:true};
}
function baseProbabilities(fixture){
 const gate=asOfEvidence(fixture);if(!gate.ok)return {ready:false,reason:gate.code};
 const f=fixture.features;
 // Independent geometric scoring rates; deliberately does not invert the price of any target market.
 const lh=clamp(Math.sqrt(Math.max(.05,f.homeGoalsFor)*Math.max(.05,f.awayGoalsAgainst)),.15,3.5);
 const la=clamp(Math.sqrt(Math.max(.05,f.awayGoalsFor)*Math.max(.05,f.homeGoalsAgainst)),.15,3.5);
 if(lh+la>6.3)return {ready:false,reason:"EXTREME_TOTAL_RATE"};
 const a=poisson(lh),b=poisson(la),distributions={had:{h:0,d:0,a:0},hhad:{h:0,d:0,a:0},ttg:{},crs:{}};
 for(let h=0;h<=MAX;h++)for(let away=0;away<=MAX;away++){
  const prob=a[h]*b[away],ft=side(h,away),goals=Math.min(7,h+away),key=scoreMarketKey(h,away);
  distributions.had[ft]+=prob;
  distributions.ttg["s"+goals]=(distributions.ttg["s"+goals]||0)+prob;
  distributions.crs[key]=prob;
  const hcap=numeric(fixture.markets.hhad?.line);
  if(hcap!==null)distributions.hhad[side(h+hcap,away)]+=prob;
 }
 const phase=f.firstHalfFraction;
 if(phase&&numeric(phase.home)!==null&&numeric(phase.away)!==null&&phase.home>.20&&phase.home<.65&&phase.away>.20&&phase.away<.65){
  const hh=poisson(lh*phase.home),ha=poisson(la*phase.away),sh=poisson(lh*(1-phase.home)),sa=poisson(la*(1-phase.away));
  distributions.hafu={};
  // Joint HT / FT pathways, distinct from multiplying marginal HTFT odds.
  for(let x=0;x<=MAX;x++)for(let y=0;y<=MAX;y++)for(let z=0;z<=MAX;z++)for(let w=0;w<=MAX;w++){
   const k=side(x,y)+side(x+z,y+w),p=hh[x]*ha[y]*sh[z]*sa[w];
   distributions.hafu[k]=(distributions.hafu[k]||0)+p;
  }
 }else distributions.hafu=null;
 return {ready:true,modelVersion:"V2-UNCALIBRATED-INDEPENDENT-POISSON",lambda:{home:+lh.toFixed(4),away:+la.toFixed(4)},
  distributions,quality:{homeSample:f.homeSample,awaySample:f.awaySample,calibrated:false},
  note:"Independent baseline only; probabilities not historically calibrated. No automatic recommendation."};
}
function allowedKeys(f,type,pool){
 const m=f.model||{},key=String(m.singlePick||"").trim();
 if(type==="direction"){
  const map={胜:"h",平:"d",负:"a",让胜:"h",让平:"d",让负:"a"};
  if(pool==="had"&&["胜","平","负"].includes(key))return [map[key]];
  if(pool==="hhad"&&["让胜","让平","让负"].includes(key))return [map[key]];
  return [];
 }
 if(type==="htft")return [pathKey(m.htftTop1)].filter(Boolean);
 if(type==="goals")return targetKeys(m.goalCandidates||m.goalRange||"");
 const scores=m.topScores||[];
 return scores.map(s=>{const p=String(s).match(/^(\d+)-(\d+)$/);return p?scoreMarketKey(Number(p[1]),Number(p[2])):null}).filter(Boolean);
}
function marketImplied(m,k){
 if(!m||!m.odds)return null;
 const odds=Number(m.odds[k]);
 return Number.isFinite(odds)&&odds>1?{odds,breakEven:1/odds}:null;
}
function perFixtureCandidates(f,type){
 const prob=baseProbabilities(f);if(!prob.ready)return {eligible:false,reason:prob.reason,variants:[]};
 const len=type==="direction"||type==="htft"?1:type==="goals"||type==="score2x2"?2:3;
 const pools=POOL[type]||[],variants=[];
 for(const pool of pools){
  const odds=f.markets[pool],ps=prob.distributions[pool];if(!odds||!ps)continue;
  const keys=allowedKeys(f,type,pool);
  const uniq=[...new Set(keys)].filter(k=>marketImplied(odds,k)&&Number.isFinite(ps[k])&&ps[k]>0);
  if(uniq.length<len)continue;
  // Ranking is by independent model probability, not lowest odds.
  uniq.sort((a,b)=>ps[b]-ps[a]||a.localeCompare(b));
  const picks=uniq.slice(0,len);
  if(type==="direction"&&Number(odds.odds[picks[0]])<2)continue;
  const sumP=picks.reduce((s,k)=>s+ps[k],0);
  const returnFactor=picks.reduce((s,k)=>s+ps[k]*Number(odds.odds[k]),0)/picks.length;
  const netExpectation=returnFactor-1;
  variants.push({matchId:f.id,num:f.num,league:f.league,model:prob.modelVersion,market:pool,picks,
   probabilities:picks.map(k=>+ps[k].toFixed(6)),prices:picks.map(k=>Number(odds.odds[k])),
   coverage:+sumP.toFixed(6),expectedReturn:+returnFactor.toFixed(6),edge:+netExpectation.toFixed(6),
   asOf:f.decisionAt,options:picks.length,calibrated:false});
 }
 return {eligible:variants.length>0,reason:variants.length?"RESEARCH_CANDIDATE":"NO_QUALIFIED_MARKET",variants};
}
function evaluatePortfolio(legs){
 const lineCount=legs.reduce((s,l)=>s*l.options,1);
 const pCover=legs.reduce((s,l)=>s*l.coverage,1);
 const returnRatio=legs.reduce((s,l)=>s*l.expectedReturn,1);
 let priceLines=[1];for(const l of legs)priceLines=priceLines.flatMap(z=>l.prices.map(p=>z*p));
 const min=Math.min(...priceLines),max=Math.max(...priceLines);
 const winningLowerThanStake=priceLines.filter(x=>x<lineCount).length;
 return {lines:lineCount,coverage:+pCover.toFixed(6),expectedGross:+returnRatio.toFixed(6),edge:+(returnRatio-1).toFixed(6),
  minOdds:+min.toFixed(4),maxOdds:+max.toFixed(4),negativeReturnBranches:winningLowerThanStake,
  status:"RESEARCH_ONLY_UNCALIBRATED"};
}
function selectDay(fixtures,{minExpectedEdge=.08,maxPairsPerType=1,requireCalibration=true}={}){
 const bad=fixtures.filter(f=>!asOfEvidence(f).ok).map(f=>({num:f.num||null,gate:asOfEvidence(f)}));
 const types=PAIRS.map(([type,n])=>{
  const all=fixtures.flatMap(f=>perFixtureCandidates(f,type).variants);
  all.sort((a,b)=>b.edge-a.edge||b.coverage-a.coverage||String(a.num).localeCompare(String(b.num)));
  const best=[],top=all.slice(0,18);
  function collect(chosen,index){
   if(chosen.length===n){
    const ids=chosen.map(x=>x.matchId);
    if(new Set(ids).size!==n)return;
    const metrics=evaluatePortfolio(chosen);
    if(metrics.edge>=minExpectedEdge)best.push({type,legs:chosen,metrics});
    return;
   }
   for(let i=index;i<top.length;i++)collect([...chosen,top[i]],i+1);
  }
  collect([],0);
  best.sort((a,b)=>b.metrics.edge-a.metrics.edge||b.metrics.coverage-a.metrics.coverage);
  const shortlist=best.slice(0,maxPairsPerType);
  return {type,eligibleSingleLegs:all.length,candidatePortfolios:best.length,abstained:!shortlist.length,
    proposals:shortlist.map(v=>({...v,publishable:!requireCalibration&&false}))};
 });
 return {version:"V2-CLEAN-SHADOW-0.1",published:false,asOfOnly:true,
  dataRejected:bad,types,warnings:["No settlement inputs accepted","All calculated probabilities are uncalibrated",
   "Historic discovery date is not out-of-sample","No candidate is automatically publishable"]};
}
module.exports={asOfEvidence,baseProbabilities,perFixtureCandidates,evaluatePortfolio,selectDay};
