"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const engine=require("./engine.cjs");
function input(id="fixture-01",num="周一001",opts={}){
 const captured="2026-10-19T08:00:00Z";
 return {
  id,num,league:"示例联赛",kickoffAt:"2026-10-19T19:00:00Z",decisionAt:"2026-10-19T12:00:00Z",
  model:{isLocked:true,lockedAt:"2026-10-19T10:00:00Z",updatedAt:"2026-10-19T10:10:00Z",singlePick:"胜",htftTop1:"胜/胜",goalCandidates:"2球｜3球｜1球",topScores:["2-1","1-1","2-0"]},
  features:{capturedAt:"2026-10-19T09:00:00Z",homeGoalsFor:1.8,homeGoalsAgainst:1.2,awayGoalsFor:1.1,awayGoalsAgainst:1.5,homeSample:10,awaySample:10},
  markets:{
   had:{capturedAt:captured,odds:{h:2.15,d:3.5,a:4.4}},
   hhad:{capturedAt:captured,line:-1,odds:{h:3.4,d:3.6,a:1.8}},
   hafu:{capturedAt:captured,odds:{hh:3.0,dh:4.4,ha:22,dd:7,aa:7,da:9,hd:18,ad:17,ah:45}},
   ttg:{capturedAt:captured,odds:{s0:15,s1:5.5,s2:3.4,s3:3.5,s4:5,s5:8,s6:16,s7:27}},
   crs:{capturedAt:captured,odds:{s02s01:8,s01s01:6.5,s02s00:9,s00s00:14,s00s01:14,s01s00:7.5,s01s02:12,s02s02:13,s03s00:12,s00s02:28}}
  },...opts
 };
}
test("rejects result or settlement fields in selection input",()=>{
 for(const field of ["ft","ht","finalScore","halfScore","settlement","isHit","actualResult","completedAt"]){
  const row=input();row[field]="2:0";assert.equal(engine.asOfEvidence(row).code,"OUTCOME_FIELD_FORBIDDEN");
 }
});
test("requires locked, coherent as-of cutoff and pre-decision markets",()=>{
 const f=input();assert.equal(engine.asOfEvidence(f).ok,true);
 f.markets.had.capturedAt="2026-10-19T13:00:00Z";assert.equal(engine.asOfEvidence(f).code,"MARKET_AFTER_DECISION");
});
test("all possible payout branches respect the 1800 floor",()=>{
 const A={options:2,coverage:.6,weightedOdds:5,minOdds:4,maxOdds:6};
 const B={options:2,coverage:.5,weightedOdds:4.5,minOdds:4,maxOdds:5};
 const good=engine.evaluatePortfolio(A,B);
 assert.equal(good.lines,4);assert.equal(good.stakePerLine,250);
 assert.equal(good.minPayout,4000);assert.equal(good.returnFloorPass,true);
 const C={options:2,coverage:.6,weightedOdds:1.7,minOdds:1.3,maxOdds:1.4};
 const D={options:2,coverage:.5,weightedOdds:1.8,minOdds:1.3,maxOdds:1.5};
 const bad=engine.evaluatePortfolio(C,D);assert.equal(bad.minPayout,422.5);assert.equal(bad.returnFloorPass,false);
});
test("minimum combined odds scales with number of equal-stake lines",()=>{
 const thresholds={1:1.8,2:3.6,4:7.2,6:10.8,9:16.2};
 for(const [lines,odds] of Object.entries(thresholds))assert.equal(engine.MIN_RETURN_RATIO*Number(lines),odds);
});
test("direction single picks must each be at least 2.00",()=>{
 const f=input();const sets=engine.selectionSets(f,"direction",1,{singleOddsFloor:2});
 assert.ok(sets.length>0);assert.ok(sets.every(s=>s.picks[0].odds>=2));
 f.markets.had.odds.h=1.4;f.markets.hhad.odds.h=1.5;
 const other=engine.selectionSets(f,"direction",1,{singleOddsFloor:2});
 assert.ok(other.every(s=>s.picks[0].odds>=2));
});
test("without real halftime fraction, half/full-time is rejected rather than invented",()=>{
 const f=input(),p=engine.baseProbabilities(f);assert.equal(p.ready,true);assert.equal(p.distributions.hafu,null);
 assert.equal(engine.selectionSets(f,"htft",1).length,0);
});
test("Poisson event distributions normalize and score selections come from available top 10",()=>{
 const f=input(),p=engine.baseProbabilities(f);
 const had=Object.values(p.distributions.had).reduce((s,x)=>s+x,0);
 const goals=Object.values(p.distributions.ttg).reduce((s,x)=>s+x,0);
 assert.ok(Math.abs(had-1)<1e-7);assert.ok(Math.abs(goals-1)<1e-7);
 const scores=engine.selectionSets(f,"score",3);assert.ok(scores.length>0);
 assert.ok(scores.every(s=>s.picks.length===3&&s.picks.every(x=>x.label.match(/^\d+-\d+$/))));
});
test("direction 1x1 candidate legs enforce individual 2.00 odds",()=>{
 const a=input(),b=input("fixture-02","周一002");
 const result=engine.buildPairCandidates([a,b],engine.STRUCTURES.find(s=>s.id==="direction_1x1"),{topK:2});
 assert.ok(result.combinationsChecked>0);
 assert.ok(result.proposals.every(p=>p.legs.every(l=>l.picks.length===1&&l.picks[0].odds>=2)));
});
test("all proposals are two distinct fixtures, floor-qualified, and never auto-publish",()=>{
 const a=input(),b=input("fixture-02","周一002");
 const result=engine.selectDay([a,b],{topK:2});
 assert.equal(result.onlyTwoLegs,true);assert.equal(result.published,false);
 for(const type of result.types)for(const p of type.proposals){
  assert.equal(p.publishable,false);assert.equal(p.legs.length,2);
  assert.notEqual(p.legs[0].fixtureId,p.legs[1].fixtureId);
  assert.ok(p.metrics.minPayout>=1800);
 }
});
test("duplicate fixture IDs fail closed",()=>{
 const a=input();assert.throws(()=>engine.selectDay([a,a]),/DUPLICATE_FIXTURE_ID/);
});
console.log("V2 2-leg return-floor tests passed");
