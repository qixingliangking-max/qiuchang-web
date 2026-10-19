/* QCDA AI Curator V2.0 — two-leg combination selector.
 * Research-only. Uses only pre-decision inputs; never reads outcomes.
 * All probabilities are an uncalibrated independent Poisson baseline until forward-validated.
 */
"use strict";
const BANKROLL=1000, MIN_RETURN=1800, MIN_RETURN_RATIO=MIN_RETURN/BANKROLL, SINGLE_DIRECTION_ODDS_FLOOR=2.0, MAX_GOALS=12;
const STRUCTURES=[
 {id:"direction_1x1",type:"direction",legs:[1,1],singleOddsFloor:2.0},
 {id:"direction_1x2",type:"direction",legs:[1,2],singleOddsFloor:2.0,reverse:true},
 {id:"direction_2x2",type:"direction",legs:[2,2]},
 {id:"htft_1x1",type:"htft",legs:[1,1]},
 {id:"goals_2x2",type:"goals",legs:[2,2]},
 {id:"score_2x2",type:"score",legs:[2,2]},
 {id:"score_3x3",type:"score",legs:[3,3]}
];
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function numeric(x){if(x===null||x===undefined||x==="")return null;const n=Number(x);return Number.isFinite(n)?n:null}
function utc(t){const v=Date.parse(t||"");return Number.isFinite(v)?v:null}
function poisson(lambda){let p=[Math.exp(-lambda)];for(let i=1;i<=MAX_GOALS;i++)p.push(p[i-1]*lambda/i);const sum=p.reduce((a,b)=>a+b,0);return p.map(x=>x/sum)}
function side(a,b){return a>b?"h":a<b?"a":"d"}
function scoreKey(a,b){return "s"+String(a).padStart(2,"0")+"s"+String(b).padStart(2,"0")}
const LABELS={h:"主胜",d:"平局",a:"客胜"};
function labelFor(pool,key){
 if(pool==="had")return LABELS[key]||key;
 if(pool==="hhad")return ({h:"让胜",d:"让平",a:"让负"})[key]||key;
 if(pool==="hafu"){const m={h:"胜",d:"平",a:"负"};return m[key[0]]+m[key[1]]}
 if(pool==="ttg")return key==="s7"?"7+球":key.slice(1)+"球";
 if(pool==="crs"){const m=key.match(/^s(\d{2})s(\d{2})$/);return m?String(Number(m[1]))+"-"+String(Number(m[2])):key}
 return key;
}
function asOfEvidence(fixture){
 if(!fixture||typeof fixture!=="object")return {ok:false,code:"INPUT_MISSING"};
 for(const key of ["ft","ht","finalScore","halfScore","settlement","isHit","actualResult","completedAt","ftScore","htScore"]){
  if(Object.prototype.hasOwnProperty.call(fixture,key))return {ok:false,code:"OUTCOME_FIELD_FORBIDDEN",field:key};
 }
 const start=utc(fixture.kickoffAt),at=utc(fixture.decisionAt),lock=utc(fixture.model?.lockedAt),edit=utc(fixture.model?.updatedAt),captured=utc(fixture.features?.capturedAt);
 if([start,at,lock,edit,captured].some(x=>x===null))return {ok:false,code:"TIMESTAMP_MISSING"};
 if(!(lock<=at&&edit<=at&&captured<=at&&at<start))return {ok:false,code:"ASOF_LEAK_OR_UNLOCKED"};
 for(const [key,market] of Object.entries(fixture.markets||{})){
  const d=utc(market.capturedAt);
  if(d===null||d>at)return {ok:false,code:"MARKET_AFTER_DECISION",market:key};
 }
 if(!fixture.model?.isLocked)return {ok:false,code:"MODEL_NOT_LOCKED"};
 const st=fixture.features,required=["homeGoalsFor","homeGoalsAgainst","awayGoalsFor","awayGoalsAgainst","homeSample","awaySample"];
 if(required.some(k=>numeric(st[k])===null))return {ok:false,code:"STAT_REQUIRED"};
 if(st.homeSample<6||st.awaySample<6)return {ok:false,code:"SAMPLE_TOO_SMALL"};
 if(required.slice(0,4).some(k=>numeric(st[k])<0))return {ok:false,code:"INVALID_GOAL_RATE"};
 return {ok:true};
}
function baseProbabilities(fixture){
 const gate=asOfEvidence(fixture);if(!gate.ok)return {ready:false,reason:gate.code};
 const f=fixture.features;
 const lh=clamp(Math.sqrt(Math.max(.05,f.homeGoalsFor)*Math.max(.05,f.awayGoalsAgainst)),.15,3.5);
 const la=clamp(Math.sqrt(Math.max(.05,f.awayGoalsFor)*Math.max(.05,f.homeGoalsAgainst)),.15,3.5);
 if(lh+la>6.3)return {ready:false,reason:"EXTREME_TOTAL_RATE"};
 const home=poisson(lh),away=poisson(la),dist={had:{h:0,d:0,a:0},hhad:null,ttg:{},crs:{}};
 const line=numeric(fixture.markets?.hhad?.line);
 if(line!==null)dist.hhad={h:0,d:0,a:0};
 for(let h=0;h<=MAX_GOALS;h++)for(let a=0;a<=MAX_GOALS;a++){
  const p=home[h]*away[a],total=Math.min(7,h+a),key=scoreKey(h,a);
  dist.had[side(h,a)]+=p;dist.ttg["s"+total]=(dist.ttg["s"+total]||0)+p;dist.crs[key]=p;
  if(dist.hhad)dist.hhad[side(h+line,a)]+=p;
 }
 const phase=f.firstHalfFraction;
 if(phase&&numeric(phase.home)!==null&&numeric(phase.away)!==null&&phase.home>.20&&phase.home<.65&&phase.away>.20&&phase.away<.65){
  const hh=poisson(lh*phase.home),ha=poisson(la*phase.away),sh=poisson(lh*(1-phase.home)),sa=poisson(la*(1-phase.away));
  dist.hafu={};for(let x=0;x<=MAX_GOALS;x++)for(let y=0;y<=MAX_GOALS;y++)for(let z=0;z<=MAX_GOALS;z++)for(let w=0;w<=MAX_GOALS;w++){
   const k=side(x,y)+side(x+z,y+w);dist.hafu[k]=(dist.hafu[k]||0)+hh[x]*ha[y]*sh[z]*sa[w];
  }
 }else dist.hafu=null;
 return {ready:true,modelVersion:"V2-UNCALIBRATED-INDEPENDENT-POISSON",lambda:{home:+lh.toFixed(4),away:+la.toFixed(4)},
  distributions:dist,quality:{homeSample:f.homeSample,awaySample:f.awaySample,calibrated:false},
  note:"Research baseline only; not historically calibrated and not publishable."};
}
function choose(n,k,out=[],start=0,buf=[]){
 if(buf.length===k){out.push(buf.slice());return out}
 for(let i=start;i<=n-(k-buf.length);i++){buf.push(i);choose(n,k,out,i+1,buf);buf.pop()}
 return out;
}
function marketOptions(f,prob,type,pool){
 const market=f.markets?.[pool],d=prob.distributions[pool];if(!market||!d||!market.odds)return [];
 let opts=Object.entries(market.odds).map(([key,value])=>({key,odds:numeric(value),p:numeric(d[key])}))
  .filter(x=>x.odds!==null&&x.odds>1&&x.p!==null&&x.p>0);
 if(type==="score"){opts.sort((a,b)=>b.p-a.p||a.key.localeCompare(b.key));opts=opts.slice(0,10)}
 else opts.sort((a,b)=>b.p-a.p||a.key.localeCompare(b.key));
 return opts;
}
function selectionSets(f,type,k,{singleOddsFloor=0}={}){
 const p=baseProbabilities(f);if(!p.ready)return [];
 const pools=type==="direction"?["had","hhad"]:type==="htft"?["hafu"]:type==="goals"?["ttg"]:["crs"];
 const all=[];
 for(const pool of pools){
  const opts=marketOptions(f,p,type,pool).filter(x=>k!==1||x.odds>=singleOddsFloor);
  if(opts.length<k)continue;
  for(const indices of choose(opts.length,k)){
   const picks=indices.map(i=>opts[i]),coverage=picks.reduce((s,x)=>s+x.p,0),weightedOdds=picks.reduce((s,x)=>s+x.p*x.odds,0);
   all.push({fixtureId:f.id,num:f.num,league:f.league,type,pool,line:numeric(f.markets?.[pool]?.line),
    picks:picks.map(x=>({key:x.key,label:labelFor(pool,x.key),probability:+x.p.toFixed(8),odds:x.odds})),
    options:k,coverage:+coverage.toFixed(8),weightedOdds:+weightedOdds.toFixed(8),
    minOdds:Math.min(...picks.map(x=>x.odds)),maxOdds:Math.max(...picks.map(x=>x.odds)),
    asOf:f.decisionAt,calibrated:false});
  }
 }
 return all;
}
function evaluatePortfolio(legA,legB,{bankroll=BANKROLL,minReturn=MIN_RETURN}={}){
 const lines=legA.options*legB.options,stakePerLine=bankroll/lines;
 const minOdds=legA.minOdds*legB.minOdds,maxOdds=legA.maxOdds*legB.maxOdds;
 const minPayout=stakePerLine*minOdds,maxPayout=stakePerLine*maxOdds;
 const hitProbability=legA.coverage*legB.coverage,expectedGrossRatio=(legA.weightedOdds*legB.weightedOdds)/lines;
 return {bankroll,lines,stakePerLine:+stakePerLine.toFixed(4),minReturnRequired:minReturn,
  minPayout:+minPayout.toFixed(2),maxPayout:+maxPayout.toFixed(2),
  minCombinedOdds:+minOdds.toFixed(4),maxCombinedOdds:+maxOdds.toFixed(4),
  minReturnRatio:+(minPayout/bankroll).toFixed(6),returnFloorPass:minPayout+1e-8>=minReturn,
  hitProbability:+hitProbability.toFixed(6),expectedGross:+expectedGrossRatio.toFixed(6),
  estimatedEdge:+(expectedGrossRatio-1).toFixed(6),probabilityCalibrated:false,status:"RESEARCH_ONLY_UNCALIBRATED"};
}
function topInsert(arr,item,limit,rank){arr.push(item);arr.sort(rank);if(arr.length>limit)arr.length=limit}
function rankCandidates(a,b){return b.metrics.expectedGross-a.metrics.expectedGross||b.metrics.hitProbability-a.metrics.hitProbability||b.metrics.minPayout-a.metrics.minPayout||String(a.legs[0].num).localeCompare(String(b.legs[0].num))}
function buildPairCandidates(fixtures,structure,{bankroll=BANKROLL,minReturn=MIN_RETURN,topK=5}={}){
 const cache=fixtures.map(f=>({f,prob:baseProbabilities(f)})),eligible=cache.filter(x=>x.prob.ready);
 const rejected=cache.filter(x=>!x.prob.ready).map(x=>({num:x.f.num,reason:x.prob.reason}));
 const pools=eligible.map(x=>({f:x.f,setsByK:{}}));
 const getSets=(entry,k,oddsFloor=0)=>{
  const key=structure.type+":"+k+":"+oddsFloor;
  if(!entry.setsByK[key])entry.setsByK[key]=selectionSets(entry.f,structure.type,k,{singleOddsFloor:oddsFloor});
  return entry.setsByK[key];
 };
 let combosSeen=0,passedFloor=0,top=[];
 for(let i=0;i<pools.length;i++)for(let j=i+1;j<pools.length;j++){
  const A=pools[i],B=pools[j];
  const orientations=structure.reverse?[[structure.legs[0],structure.legs[1]],[structure.legs[1],structure.legs[0]]]:[structure.legs];
  for(const ks of orientations){
   const floorA=ks[0]===1?structure.singleOddsFloor||0:0,floorB=ks[1]===1?structure.singleOddsFloor||0:0;
   const left=getSets(A,ks[0],floorA),right=getSets(B,ks[1],floorB);
   if(!left.length||!right.length)continue;
   for(const a of left)for(const b of right){
    combosSeen++;const metrics=evaluatePortfolio(a,b,{bankroll,minReturn});
    if(!metrics.returnFloorPass)continue;passedFloor++;
    const candidate={structure:structure.id,type:structure.type,legs:[a,b],metrics,publishable:false,
     note:"Uncalibrated shadow candidate; return floor passed, profitability not established."};
    topInsert(top,candidate,topK,rankCandidates);
   }
  }
 }
 return {structure:structure.id,totalFixtures:fixtures.length,dataEligible:eligible.length,dataRejected:rejected.length,
  rejected,combinationsChecked:combosSeen,returnFloorPassed:passedFloor,abstained:top.length===0,proposals:top};
}
function selectDay(fixtures,{bankroll=BANKROLL,minReturn=MIN_RETURN,topK=3,structures=STRUCTURES}={}){
 const seen=new Set();for(const f of fixtures){if(seen.has(f.id))throw Error("DUPLICATE_FIXTURE_ID");seen.add(f.id)}
 const types=structures.map(s=>buildPairCandidates(fixtures,s,{bankroll,minReturn,topK}));
 return {version:"V2-CLEAN-SHADOW-0.2",bankroll,minReturn,minReturnRatio:+(minReturn/bankroll).toFixed(6),
  requiredMinCombinedOddsByLines:Object.fromEntries([1,2,4,6,9].map(n=>[n,+(minReturn/bankroll*n).toFixed(4)])),
  onlyTwoLegs:true,published:false,asOfOnly:true,types,
  warnings:["Every candidate is two distinct fixtures only","Each possible winning branch must return at least the configured minimum",
   "Probabilities remain uncalibrated; estimated EV is research-only","No candidate auto-publishes; no outcomes are read by this module"]};
}
module.exports={BANKROLL,MIN_RETURN,MIN_RETURN_RATIO,SINGLE_DIRECTION_ODDS_FLOOR,STRUCTURES,
 asOfEvidence,baseProbabilities,selectionSets,evaluatePortfolio,buildPairCandidates,selectDay};
