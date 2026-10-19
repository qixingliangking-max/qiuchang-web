"use strict";
/* QCDA curated selector V1.0-R1: 4 analysts / 5 project structures.
   Original V1.0 historical frozen selections are immutable; R1 applies only
   to new shadow research records, never silently reruns the V1.0 archive.
   This is a structural/stake checker, NOT a recreated selection/scoring model.
*/
const VERSION="CURATED_V1_0_R1_STRUCTURES_20261020";
const ORIGINAL_BASELINE="BLIND_SELECTOR_V1_20261005_18";
const ORIGINAL_SELECTION_SHA="1f5c7b346be18aac4740f677cb844ba9045154a3";
const BANKROLL_CENTS=100000;
const PROJECTS=Object.freeze([
 Object.freeze({id:"direction",analyst:"方向精选师",markets:["had","hhad"],legs:2,choicesPerLeg:1,branchCount:1,minWinningPayout:1800,protectedFromV1:true}),
 Object.freeze({id:"htft",analyst:"半全场精选师",markets:["hafu"],legs:1,choicesPerLeg:1,branchCount:1,minWinningPayout:1800,protectedFromV1:false}),
 Object.freeze({id:"goals",analyst:"总进球精选师",markets:["ttg"],legs:1,choicesPerLeg:2,branchCount:2,minWinningPayout:1800,protectedFromV1:false}),
 Object.freeze({id:"score_2",analyst:"比分精选师",markets:["crs"],legs:2,choicesPerLeg:3,branchCount:9,minWinningPayout:1800,protectedFromV1:true}),
 Object.freeze({id:"score_3",analyst:"比分精选师",markets:["crs"],legs:3,choicesPerLeg:3,branchCount:27,minWinningPayout:2800,protectedFromV1:false})
]);
function fail(code){throw Error(code)}
function getProject(id){const p=PROJECTS.find(p=>p.id===id);if(!p)fail("UNSUPPORTED_PROJECT");return p}
function centSplit(total,count){
 if(!Number.isInteger(total)||total<0||!Number.isInteger(count)||count<1)fail("BAD_STAKE");
 const per=Math.floor(total/count),extra=total-per*count;
 return Array.from({length:count},(_,i)=>per+(i<extra?1:0));
}
function finiteOdd(v){const n=Number(v);if(!Number.isFinite(n)||n<=1)fail("INVALID_ODD");return n}
function noResults(source){
 const forbidden=["ft","ht","ft_score","ht_score","finalScore","halfScore","result","outcome","settlement","winning"];
 for(const f of forbidden)if(Object.prototype.hasOwnProperty.call(source,f))fail("OUTCOME_FIELD_NOT_ALLOWED:"+f);
}
function validatePlan(plan){
 if(!plan||typeof plan!=="object")fail("PLAN_MISSING");
 noResults(plan);
 const p=getProject(plan.project);
 if(plan.budget!==1000)fail("BUDGET_NOT_1000");
 if(!Array.isArray(plan.legs)||plan.legs.length!==p.legs)fail("WRONG_NUMBER_OF_FIXTURES");
 const at=Date.parse(plan.selectedAt);
 if(!Number.isFinite(at))fail("SELECTION_TIMESTAMP_MISSING");
 const seen=new Set();
 for(const leg of plan.legs){
  if(!leg||typeof leg!=="object")fail("LEG_MISSING");
  noResults(leg);
  if(!leg.fixtureId||seen.has(leg.fixtureId))fail("DUPLICATE_OR_MISSING_FIXTURE");
  seen.add(leg.fixtureId);
  const kickoff=Date.parse(leg.kickoffAt),marketAt=Date.parse(leg.marketAt);
  if(!Number.isFinite(kickoff)||!Number.isFinite(marketAt)||!(marketAt<=at&&at<kickoff))fail("NON_PREMATCH_SNAPSHOT");
  if(!p.markets.includes(leg.market))fail("INCORRECT_MARKET");
  if(!Array.isArray(leg.choices)||leg.choices.length!==p.choicesPerLeg)fail("WRONG_SELECTIONS_PER_FIXTURE");
  const choices=new Set();
  for(const choice of leg.choices){
   if(!choice||typeof choice!=="object")fail("CHOICE_MISSING");
   noResults(choice);
   if(typeof choice.key!=="string"||!choice.key||choices.has(choice.key))fail("DUPLICATE_OR_MISSING_CHOICE");
   choices.add(choice.key);
   finiteOdd(choice.odd);
  }
 }
 return p;
}
function branches(plan){
 const project=validatePlan(plan);
 let t=[{selection:[],combinedOdd:1}];
 for(const leg of plan.legs){
  t=t.flatMap(row=>leg.choices.map(choice=>({
   selection:[...row.selection,{fixtureId:leg.fixtureId,market:leg.market,key:choice.key}],
   combinedOdd:row.combinedOdd*finiteOdd(choice.odd)
  })));
 }
 if(t.length!==project.branchCount)fail("TICKET_COUNT_ERROR");
 const cents=centSplit(BANKROLL_CENTS,t.length);
 const tickets=t.map((x,i)=>({...x,stakeCents:cents[i],
  winningPayout:Math.round(x.combinedOdd*cents[i])/100}));
 const minimumPayout=Math.min(...tickets.map(t=>t.winningPayout));
 const result={version:VERSION,project:project.id,tickets,branchCount:tickets.length,
  budget:1000,minimumPayout,highestPayout:Math.max(...tickets.map(x=>x.winningPayout)),
  minAllowedPayout:project.minWinningPayout,qualified:minimumPayout>=project.minWinningPayout};
 return result;
}
function evaluateSettled(plan,events){
 const x=branches(plan);
 if(!events||typeof events!=="object")fail("MISSING_EVENTS");
 const seen=x.tickets[0].selection.map(s=>s.fixtureId);
 for(const id of seen)if(typeof events[id]!=="string")return {state:"PENDING",project:plan.project,budget:1000};
 const winner=x.tickets.find(ticket=>ticket.selection.every(s=>events[s.fixtureId]===s.key));
 const payout=winner?winner.winningPayout:0;
 return {state:winner?"HIT":"MISS",project:plan.project,budget:1000,payout,net:+(payout-1000).toFixed(2),eligible:x.qualified};
}
module.exports={VERSION,ORIGINAL_BASELINE,ORIGINAL_SELECTION_SHA,PROJECTS,getProject,centSplit,validatePlan,branches,evaluateSettled};
