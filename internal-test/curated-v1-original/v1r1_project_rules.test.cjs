"use strict";
const assert=require("node:assert/strict");
const P=require("./v1r1_project_rules.cjs");
const types={
 direction:{odd:2.2,market:"had",n:2,k:1,expected:1},
 htft:{odd:2.1,market:"hafu",n:1,k:1,expected:1},
 goals:{odd:3.7,market:"ttg",n:1,k:2,expected:2},
 score_2:{odd:7.0,market:"crs",n:2,k:3,expected:9},
 score_3:{odd:8.0,market:"crs",n:3,k:3,expected:27}
};
function plan(type){
 const c=types[type];return {project:type,budget:1000,selectedAt:"2026-10-20T12:30:00Z",
 legs:Array.from({length:c.n},(_,i)=>({fixtureId:type+"_"+i,kickoffAt:"2026-10-21T19:00:00Z",
 marketAt:"2026-10-20T12:00:00Z",market:c.market,
 choices:Array.from({length:c.k},(_,j)=>({key:c.market+"_"+j,odd:c.odd+.2*j}))}))};
}
assert.equal(P.PROJECTS.length,5);
assert.equal(new Set(P.PROJECTS.map(p=>p.analyst)).size,4);
for(const [name,c] of Object.entries(types)){
 const x=plan(name),r=P.branches(x);
 assert.equal(r.branchCount,c.expected);
 assert.equal(r.tickets.length,c.expected);
 assert.equal(r.tickets.reduce((sum,t)=>sum+t.stakeCents,0),100000);
 assert.ok(r.tickets.every(t=>t.winningPayout>=r.minAllowedPayout));
 assert.ok(r.qualified);
 const event=Object.fromEntries(r.tickets[0].selection.map(s=>[s.fixtureId,s.key]));
 const hit=P.evaluateSettled(x,event);
 assert.equal(hit.state,"HIT");assert.equal(hit.payout,r.tickets[0].winningPayout);
 assert.equal(P.evaluateSettled(x,{}).state,"PENDING");
}
const g=P.branches(plan("goals"));
assert.deepEqual(g.tickets.map(t=>t.stakeCents),[50000,50000]);
assert.equal(g.minimumPayout,1850);
assert.deepEqual(P.branches(plan("score_2")).tickets.map(x=>x.stakeCents),
 Array.from({length:9},(_,i)=>i===0?11112:11111));
assert.deepEqual(P.branches(plan("score_3")).tickets.map(x=>x.stakeCents),
 Array.from({length:27},(_,i)=>i<19?3704:3703));
assert.throws(()=>P.validatePlan({...plan("goals"),ft:"2:1"}),/OUTCOME_FIELD_NOT_ALLOWED/);
const dup=plan("goals");dup.legs[0].choices[1].key=dup.legs[0].choices[0].key;
assert.throws(()=>P.validatePlan(dup),/DUPLICATE_OR_MISSING_CHOICE/);
const late=plan("goals");late.legs[0].marketAt="2026-10-20T15:00:00Z";
assert.throws(()=>P.validatePlan(late),/NON_PREMATCH_SNAPSHOT/);
const bad=plan("goals");bad.legs[0].choices=[bad.legs[0].choices[0]];
assert.throws(()=>P.validatePlan(bad),/WRONG_SELECTIONS_PER_FIXTURE/);
const low=plan("goals");low.legs[0].choices.forEach(c=>c.odd=3.1);
assert.equal(P.branches(low).qualified,false);
console.log("V1.0-R1 FIVE PROJECTS PASS: 1/1/2/9/27 lines, exact cent splits, payout floors, result-leak guards");
