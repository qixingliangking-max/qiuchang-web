"use strict";
/** QCDA | SIX INDEPENDENT MATCH ANALYSTS / AS-OF-ONLY EXPERIMENT
 * Six independently parameterized roles. NO event results are inputs. NO publication.
 * Pick selection: highest estimated event probability subject to nominal return floor,
 * rather than sorting by the shortest odds. Probabilities uncalibrated.
 */
const CONFIG=[
 {id:"DIRECTION_2",label:"胜平负2.0",kind:"direction",legs:2,options:1,minReturn:1800},
 {id:"DIRECTION_3",label:"胜平负3.0",kind:"direction",legs:2,options:1,minReturn:2800},
 {id:"GOALS_DOUBLE",label:"总进球单场双选",kind:"goals",legs:1,options:2,minReturn:1800},
 {id:"SCORE_2",label:"比分2场各3选",kind:"score",legs:2,options:3,minReturn:1800},
 {id:"SCORE_3",label:"比分3场各3选",kind:"score",legs:3,options:3,minReturn:2800},
 {id:"HTFT_SINGLE",label:"半全场单场单选",kind:"htft",legs:1,options:1,minReturn:1800}
];
const RISK_NOTE="Uncalibrated independent Poisson attack/defense rates; halftime share estimated at 45%; no claims of true hit probability or profitable EV";
function assert(b,s){if(!b)throw Error(s)}
function number(x){if(x===null||x===undefined||x==="")return NaN;const a=Number(x);return Number.isFinite(a)?a:NaN}
function poisson(x,n=10){let p=[Math.exp(-x)];for(let i=1;i<=n;i++)p.push(p[i-1]*x/i);return p}
function side(a,b){return a>b?"h":a<b?"a":"d"}
function fullScore(h,a){return "s"+String(h).padStart(2,"0")+"s"+String(a).padStart(2,"0")}
function pDist(f){
 const g=f.features||{};
 const fields=["homeGoalsFor","homeGoalsAgainst","awayGoalsFor","awayGoalsAgainst"];
 if(fields.some(k=>!Number.isFinite(number(g[k]))||number(g[k])<0)||number(g.samples)<5)return null;
 const gfH=number(g.homeGoalsFor),gaH=number(g.homeGoalsAgainst),gfA=number(g.awayGoalsFor),gaA=number(g.awayGoalsAgainst);
 // Prior-independent means: no target event prices enter lambda.
 let lh=Math.min(3.6,Math.max(.20,Math.sqrt(Math.max(.08,gfH)*Math.max(.08,gaA)))),
     la=Math.min(3.6,Math.max(.20,Math.sqrt(Math.max(.08,gfA)*Math.max(.08,gaH))));
 // 10% damping for volatile 10-match average and league transfer.
 lh=.90*lh+.10*1.35;la=.90*la+.10*1.15;
 const h=poisson(lh),a=poisson(la),ft={h:0,d:0,a:0},goal={},score={};
 const handicap=Number.isFinite(number(f.markets?.hhad?.line))?Number(f.markets.hhad.line):null;
 const hhad=handicap===null?null:{h:0,d:0,a:0};
 for(let x=0;x<h.length;x++)for(let y=0;y<a.length;y++){
  const p=h[x]*a[y];ft[side(x,y)]+=p;goal["s"+Math.min(7,x+y)]=(goal["s"+Math.min(7,x+y)]||0)+p;
  score[fullScore(x,y)]=p;if(hhad)hhad[side(x+handicap,y)]+=p;
 }
 // HTFT split deliberately independent baseline, an assumption NOT historical half-time evidence.
 const hh=poisson(.45*lh,8),ha=poisson(.45*la,8),sh=poisson(.55*lh,8),sa=poisson(.55*la,8),htft={};
 for(let x=0;x<hh.length;x++)for(let y=0;y<ha.length;y++)for(let z=0;z<sh.length;z++)for(let w=0;w<sa.length;w++){
  const key=side(x,y)+side(x+z,y+w);htft[key]=(htft[key]||0)+hh[x]*ha[y]*sh[z]*sa[w];
 }
 return {lambda:[+lh.toFixed(4),+la.toFixed(4)],ft,hhad,goal,score,htft,model:"SixAnalysts_R1_STAT_ONLY_uncalibrated"};
}
function parseFixture(raw){
 // Only allowed pre-match keys. Throw if user requests forced leak.
 for(const k of ["ft","ht","ft_score","ht_score","result","settlement","fullTime","halfTime"])assert(!Object.hasOwn(raw,k),"SELECTION_RESULT_FIELD:"+k);
 const cutoff=Date.parse(raw.cutoff),kick=Date.parse(raw.kickoff_at);
 if(!Number.isFinite(cutoff)||!Number.isFinite(kick)||cutoff>=kick)return null;
 if(raw.feature_time && Date.parse(raw.feature_time)>cutoff)return null;
 const markets={};for(const [pool,obj] of Object.entries(raw.markets||{})){
  if(Date.parse(obj.capturedAt)>cutoff)throw Error("LATE_ODDS");
  markets[pool]={line:obj.line,odds:obj.odds,capturedAt:obj.capturedAt};
 }
 return {id:raw.id,date:raw.day,num:raw.num,league:raw.league,
  home:raw.home,away:raw.away,kickoffAt:raw.kickoff_at,cutoff:raw.cutoff,features:raw.features,markets};
}
function display(pool,key){
 if(pool==="ttg")return key==="s7"?"7+球":key.slice(1)+"球";
 if(pool==="crs"){const m=key.match(/^s(\d{2})s(\d{2})$/);return m?+m[1]+"-"+ +m[2]:key}
 if(pool==="hafu"){const t={h:"胜",d:"平",a:"负"};return t[key[0]]+t[key[1]]}
 const t={h:"胜",d:"平",a:"负"};return pool==="hhad"?"让"+t[key]:t[key];
}
function options(m,pool,dist){
 if(!m||!m.odds||!dist)return [];
 return Object.entries(m.odds).map(([k,odds])=>({key:k,pool,odds:number(odds),p:dist[k]}))
  .filter(o=>Number.isFinite(o.odds)&&o.odds>1&&Number.isFinite(o.p)&&o.p>0);
}
function combos(items,n){const o=[];function f(i,sofar){if(sofar.length===n){o.push(sofar.slice());return}
 for(let j=i;j<=items.length-(n-sofar.length);j++){sofar.push(items[j]);f(j+1,sofar);sofar.pop()}}
 f(0,[]);return o;}
function legCandidates(f,model,config){
 const kind=config.kind;
 if(kind==="direction"){
   const had=options(f.markets.had,"had",model.ft),
   hhad=options(f.markets.hhad,"hhad",model.hhad);
   return [...had,...hhad].map(o=>({fixtureId:f.id,num:f.num,home:f.home,away:f.away,league:f.league,
     pool:o.pool,picks:[{key:o.key,label:display(o.pool,o.key),odds:o.odds,modelP:+o.p.toFixed(6)}],
     coverage:o.p,lowerOdds:o.odds,upperOdds:o.odds,lambda:model.lambda,cutoff:f.cutoff}));
 }
 const pool=kind==="htft"?"hafu":kind==="goals"?"ttg":"crs",dist=kind==="htft"?model.htft:kind==="goals"?model.goal:model.score,
 opts=options(f.markets[pool],pool,dist).sort((a,b)=>b.p-a.p);
 const selected=kind==="score"?opts.slice(0,7):kind==="goals"?opts.slice(0,7):opts.slice(0,9);
 const sets=combos(selected,config.options);
 return sets.map(ps=>({fixtureId:f.id,num:f.num,home:f.home,away:f.away,league:f.league,pool,
  picks:ps.map(o=>({key:o.key,label:display(pool,o.key),odds:o.odds,modelP:+o.p.toFixed(6)})),
  coverage:ps.reduce((s,o)=>s+o.p,0),lowerOdds:Math.min(...ps.map(p=>p.odds)),
  upperOdds:Math.max(...ps.map(p=>p.odds)),lambda:model.lambda,cutoff:f.cutoff}));
}
function evaluate(legs,conf){
 let tickets=[{keys:[],price:1}];for(const leg of legs)
  tickets=tickets.flatMap(t=>leg.picks.map(p=>({keys:t.keys.concat(p.key),price:t.price*p.odds})));
 const cents=Math.round(1000*100),n=tickets.length,per=Math.floor(cents/n),remainder=cents-per*n;
 const amounts=tickets.map((t,i)=>(per+(i<remainder?1:0))/100);
 const returns=tickets.map((t,i)=>t.price*amounts[i]);const lowest=Math.min(...returns),highest=Math.max(...returns);
 const coverage=legs.reduce((x,l)=>x*l.coverage,1);
 return {tickets:n,stake:1000,allocationCents:{base:per,extraFirst:remainder},
   minReturn:conf.minReturn,minPayout:+lowest.toFixed(2),maxPayout:+highest.toFixed(2),
   minCombinedOdds:+Math.min(...tickets.map(t=>t.price)).toFixed(4),
   modeledHitProbability:+coverage.toFixed(6),eligible:lowest+1e-8>=conf.minReturn};
}
function selectRole(fixtures,conf){
 throw new Error('SIX_MATCH_ANALYSTS_OFFLINE_BY_USER: six analyst roles retired; do not screen further matches.');
 // Six independent streams; no scores and no locked-model picks used.
 const legs=[];
 for(const fixture of fixtures){const model=pDist(fixture);if(!model)continue;
  legs.push(...legCandidates(fixture,model,conf));}
 let best=null,considered=0,eligible=0;
 // For multi-option roles, limit to top 2 sets per fixture by event mass.
 const maxPerFixture=conf.kind==="score"?2:conf.kind==="goals"?3:conf.kind==="direction"?3:1;
 const groups={};for(const leg of legs)(groups[leg.fixtureId]??=[]).push(leg);
 for(const g of Object.values(groups))g.sort((a,b)=>b.coverage-a.coverage);
 const pack=Object.values(groups).flatMap(g=>g.slice(0,maxPerFixture));
 // Search top 25 most plausible fixtures, rather than combine all lottery paths.
 pack.sort((a,b)=>b.coverage-a.coverage);
 const pool=pack.slice(0,conf.legs===3?75:120);
 function tryLegs(selected,start){
  if(selected.length===conf.legs){
   if(new Set(selected.map(l=>l.fixtureId)).size!==conf.legs)return;
   considered++;const metrics=evaluate(selected,conf);if(!metrics.eligible)return;
   eligible++;
   const quality=metrics.modeledHitProbability;
   if(!best||quality>best.metrics.modeledHitProbability+1e-8||
       (Math.abs(quality-best.metrics.modeledHitProbability)<=1e-8 && metrics.minPayout>best.metrics.minPayout)){
    best={role:conf.id,label:conf.label,legs:selected.map(l=>({...l,coverage:+l.coverage.toFixed(6)})),metrics,published:false};
   }
   return;
  }
  for(let i=start;i<pool.length;i++){
   if(selected.some(s=>s.fixtureId===pool[i].fixtureId))continue;
   tryLegs([...selected,pool[i]],i+1);
  }
 }
 // For 3 legs cost grows cubically (~75 choose 3 = 67k), budget reasonable.
 tryLegs([],0);
 return {id:conf.id,name:conf.label,state:best?"FROZEN_RESEARCH":"ABSTAIN",eligibleFixtures:Object.keys(groups).length,
  optionsConsidered:considered,passesReturn:eligible,selected:best||null};
}
function selectDays(fixtures){
 throw new Error('SIX_MATCH_ANALYSTS_OFFLINE_BY_USER: six analyst roles retired; do not freeze any further selections.');
 const ds=[...new Set(fixtures.map(x=>x.date))].sort(),out={};
 for(const d of ds){const group=fixtures.filter(f=>f.date===d);out[d]={
  totalFixtures:group.length,modelEligible:group.filter(f=>!!pDist(f)).length,
  roles:CONFIG.map(c=>selectRole(group,c))}}
 return {engine:"SIX_INDEPENDENT_EVENT_ANALYSTS_R1",status:"ACTIVE_RESEARCH_ONLY",historicalReplay:true,
  window:["2026-10-05","2026-10-19"],programmingNotes:RISK_NOTE,bankrollPerRole:1000,days:out};
}
module.exports={CONFIG,parseFixture,pDist,legCandidates,evaluate,selectRole,selectDays};
