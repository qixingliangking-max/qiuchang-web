"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const engine=require("./engine.cjs");
function input(id="fixture-01",num="周一001",direction="胜 / 平",opts={}){
 const c="2026-10-19T08:00:00Z";
 return {id,num,league:"示例联赛",kickoffAt:"2026-10-19T19:00:00Z",decisionAt:"2026-10-19T12:00:00Z",
  model:{isLocked:true,lockedAt:"2026-10-19T10:00:00Z",updatedAt:"2026-10-19T10:10:00Z",direction,handicapDirection:"让负 / 让胜",
   singlePick:"胜",htftTop1:"胜/胜",htftTop2:"平/胜",goalCandidates:"2球｜3球｜5球",topScores:["2-1","1-1","1-0"]},
  features:{},markets:{
   had:{capturedAt:c,odds:{h:2.1,d:3.2,a:4.4}},
   hhad:{capturedAt:c,line:-1,odds:{h:3.4,d:3.6,a:1.9}},
   hafu:{capturedAt:c,odds:{hh:3.1,dh:4.4,ha:22,dd:7,aa:7,da:9,hd:18,ad:17,ah:45}},
   ttg:{capturedAt:c,odds:{s0:15,s1:5.5,s2:3.4,s3:3.5,s4:5,s5:8,s6:16,s7:27}},
   crs:{capturedAt:c,odds:{s02s01:8,s01s01:6.5,s02s00:9,s00s00:14,s00s01:14,s01s00:7.5,s01s02:12,s02s02:13,s03s00:12,s00s02:28}}
  },...opts};
}
test("result and settlement fields are blocked",()=>{
 for(const field of ["ft","ht","finalScore","settlement","isHit","actualResult","completedAt"]){const f=input();f[field]="1:0";assert.equal(engine.asOfEvidence(f).code,"OUTCOME_FIELD_FORBIDDEN")}
});
test("decision cutoff and market timestamps are enforced",()=>{
 const f=input();assert.equal(engine.asOfEvidence(f).ok,true);
 f.markets.had.capturedAt="2026-10-19T13:00:00Z";assert.equal(engine.asOfEvidence(f).code,"MARKET_AFTER_DECISION");
});
test("every winning line must return at least 1800 from a 1000 budget",()=>{
 const good=engine.evaluatePortfolio({options:2,coverage:.6,weightedOdds:5,minOdds:4,maxOdds:6},{options:2,coverage:.5,weightedOdds:4.5,minOdds:4,maxOdds:5});
 assert.equal(good.lines,4);assert.equal(good.stakePerLine,250);assert.equal(good.minPayout,4000);assert.equal(good.returnFloorPass,true);
 const bad=engine.evaluatePortfolio({options:2,coverage:.6,weightedOdds:1.7,minOdds:1.3,maxOdds:1.4},{options:2,coverage:.5,weightedOdds:1.8,minOdds:1.3,maxOdds:1.5});
 assert.equal(bad.minPayout,422.5);assert.equal(bad.returnFloorPass,false);
});
test("single direction uses locked single pick and enforces odds >= 2.00",()=>{
 const s=engine.selectionSets(input(),"direction",1,{singleOddsFloor:2});
 assert.equal(s.length,1);assert.equal(s[0].picks[0].key,"h");assert.ok(s[0].picks[0].odds>=2);
});
test("direction doubles are restricted to model direction or handicap pair",()=>{
 const s=engine.selectionSets(input(),"direction",2);
 assert.ok(s.length>0);
 assert.ok(s.every(x=>(x.pool==="had"&&x.picks.every(p=>["h","d"].includes(p.key)))||(x.pool==="hhad"&&x.picks.every(p=>["a","h"].includes(p.key))));
});
test("goal candidates are restricted to the frozen model goal range",()=>{
 const s=engine.selectionSets(input(),"goals",2);assert.equal(s.length,3);
 assert.ok(s.every(x=>x.picks.every(p=>["s2","s3","s5"].includes(p.key))));
});
test("score candidates are restricted to the frozen model TOP3",()=>{
 const s=engine.selectionSets(input(),"score",2);assert.equal(s.length,3);
 assert.ok(s.every(x=>x.picks.every(p=>["s02s01","s01s01","s01s00"].includes(p.key))));
});
test("HTFT uses frozen model TOP1 and market prior when stats are absent",()=>{
 const s=engine.selectionSets(input(),"htft",1);assert.equal(s.length,1);
 assert.equal(s[0].picks[0].key,"hh");assert.equal(s[0].picks[0].statProbability,null);
});
test("missing feature snapshot does not erase valid locked model candidates",()=>{
 const f=input();assert.equal(engine.asOfEvidence(f).statsAvailable,false);
 assert.ok(engine.selectionSets(f,"score",3).length>0);
});
test("all proposals are two distinct fixtures, payout-qualified, and never auto-publish",()=>{
 const r=engine.selectDay([input(),input("fixture-02","周一002","负 / 平")],{topK:2});
 assert.equal(r.onlyTwoLegs,true);assert.equal(r.published,false);
 for(const t of r.types)for(const p of t.proposals){assert.equal(p.publishable,false);assert.equal(p.legs.length,2);
  assert.notEqual(p.legs[0].fixtureId,p.legs[1].fixtureId);assert.ok(p.metrics.minPayout>=1800)}
});
test("duplicate fixture IDs fail closed",()=>{const f=input();assert.throws(()=>engine.selectDay([f,f]),/DUPLICATE_FIXTURE_ID/)});
console.log("V2.2 model-constrained tests passed");
