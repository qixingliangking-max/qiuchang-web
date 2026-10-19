"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const engine=require("./engine.cjs");
function input(id="fixture-01",num="周日001",options={}){
 const captured="2026-10-19T08:00:00Z";
 return {
  id,num,league:"示例联赛",kickoffAt:"2026-10-19T19:00:00Z",decisionAt:"2026-10-19T12:00:00Z",
  model:{isLocked:true,lockedAt:"2026-10-19T10:00:00Z",updatedAt:"2026-10-19T10:10:00Z",
    singlePick:"胜",htftTop1:"胜/胜",goalCandidates:"2球｜3球｜1球",topScores:["2-1","1-1","2-0"]},
  features:{capturedAt:"2026-10-19T09:00:00Z",homeGoalsFor:1.8,homeGoalsAgainst:1.2,awayGoalsFor:1.1,awayGoalsAgainst:1.5,homeSample:10,awaySample:10},
  markets:{
   had:{capturedAt:captured,odds:{h:2.15,d:3.5,a:4.4}},
   hhad:{capturedAt:captured,line:-1,odds:{h:3.4,d:3.6,a:1.8}},
   hafu:{capturedAt:captured,odds:{hh:3.0,dh:4.4,ha:22,dd:7,aa:7,da:9,hd:18,ad:17,ah:45}},
   ttg:{capturedAt:captured,odds:{s0:15,s1:5.5,s2:3.4,s3:3.5,s4:5,s5:8,s6:16,s7:27}},
   crs:{capturedAt:captured,odds:{s02s01:8,s01s01:6.5,s02s00:9}}
  },...options
 };
}
test("rejects actual FT/HT and settlement on a selector input",()=>{
 for(const field of ["ft","ht","finalScore","settlement","completedAt"]){
  const row=input();row[field]="0:0";
  assert.equal(engine.asOfEvidence(row).code,"OUTCOME_FIELD_FORBIDDEN");
 }
});
test("requires an actual pre-kick lock and coherent source cutoff",()=>{
 const f=input();assert.equal(engine.asOfEvidence(f).ok,true);
 f.decisionAt="2026-10-19T09:00:00Z";assert.equal(engine.asOfEvidence(f).code,"ASOF_LEAK_OR_UNLOCKED");
 f.decisionAt="2026-10-19T12:00:00Z";
 f.markets.had.capturedAt="2026-10-19T13:00:00Z";assert.equal(engine.asOfEvidence(f).code,"MARKET_AFTER_DECISION");
});
test("does not accept missing halftime evidence as half/fulltime probabilities",()=>{
 const p=engine.baseProbabilities(input());assert.equal(p.ready,true);
 assert.equal(p.distributions.hafu,null);
 let s=Object.values(p.distributions.had).reduce((a,b)=>a+b,0);assert.ok(Math.abs(s-1)<1e-7);
 const g=Object.values(p.distributions.ttg).reduce((a,b)=>a+b,0);assert.ok(Math.abs(g-1)<1e-7);
});
test("with actual halftime fractions, all nine HTFT paths sum to one",()=>{
 const f=input();f.features.firstHalfFraction={home:.43,away:.46};
 const r=engine.baseProbabilities(f);assert.equal(r.ready,true);assert.equal(Object.keys(r.distributions.hafu).length,9);
 const s=Object.values(r.distributions.hafu).reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(s-1)<1e-6);
});
test("rejects unusable sample size or impossible goal rates",()=>{
 const f=input();f.features.homeSample=3;assert.equal(engine.asOfEvidence(f).code,"SAMPLE_TOO_SMALL");
 f.features.homeSample=8;f.features.homeGoalsFor=-1;assert.equal(engine.asOfEvidence(f).code,"INVALID_GOAL_RATE");
});
test("requires a handicap line instead of silently inventing zero",()=>{
 const f=input();f.markets.hhad.line=null;
 const p=engine.baseProbabilities(f);assert.equal(p.ready,true);
 assert.deepEqual(p.distributions.hhad,{h:0,d:0,a:0});
});
test("direction trial respects each game's >=2.00 price and never changes to handicap without freeze",()=>{
 const f=input();
 assert.ok(engine.perFixtureCandidates(f,"direction").variants.some(x=>x.market==="had"&&x.prices[0]===2.15));
 f.markets.had.odds.h=1.4;
 assert.equal(engine.perFixtureCandidates(f,"direction").variants.length,0);
});
test("combination evaluation is equal stake not bookmaker implied stake",()=>{
 const A={options:2,coverage:.55,expectedReturn:1.10,prices:[3.5,4.5]},
       B={options:2,coverage:.40,expectedReturn:1.05,prices:[4,6]};
 const x=engine.evaluatePortfolio([A,B]);
 assert.equal(x.lines,4);assert.equal(x.minOdds,14);
 assert.equal(x.coverage,.22);assert.equal(x.expectedGross,1.155);
});
test("rejected data and uncalibrated candidates never become published",()=>{
 const rows=[input(),input("fixture-02","周日002"),input("fixture-03","周日003")];
 const r=engine.selectDay(rows,{minExpectedEdge:-20});
 assert.equal(r.published,false);
 assert.equal(r.dataRejected.length,0);
 assert.ok(r.types.every(z=>z.proposals.every(p=>p.publishable===false)));
 assert.ok(r.types.find(x=>x.type==="htft").abstained);
 const other=input("late","周日004",{decisionAt:"2026-10-20T01:00:00Z"});
 const bad=engine.selectDay([other]);assert.equal(bad.dataRejected[0].gate.code,"ASOF_LEAK_OR_UNLOCKED");
});
console.log("All V2 engine checks passed");
