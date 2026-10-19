"use strict";
/**
 * QCDA FOUR V1.0 restoration registry — EXACT frozen originals only.
 * Prior six match-analyst roles and later V1.1/V1.2/V2 are not dependencies.
 * Archived V1.0 calculation/selection source is not available as an independently
 * runnable producer; DO NOT imitate it using newer heuristics or claim that archived
 * daily entries are new forward predictions.
 */
const RESTORED_VERSION="BLIND_SELECTOR_V1_20261005_18";
const RESTORED_SELECTION_SHA="1f5c7b346be18aac4740f677cb844ba9045154a3";
const RESTORED_SETTLEMENT_SHA="d78744c83abd70d8827c1fbc6b3e1333b8b44f70";
const ROLES=Object.freeze([
 Object.freeze({id:"direction",name:"胜平负方向精选师V1.0",status:"RESTORED_RESEARCH",focus:true,originalSimNet:2936.80}),
 Object.freeze({id:"htft",name:"半全场精选师V1.0",status:"RESTORED_RESEARCH",focus:false,originalSimNet:-6039.85}),
 Object.freeze({id:"goals",name:"总进球精选师V1.0",status:"RESTORED_RESEARCH",focus:false,originalSimNet:-5890.00}),
 Object.freeze({id:"score",name:"比分精选师V1.0",status:"RESTORED_RESEARCH",focus:true,originalSimNet:4699.81})
]);
const originalBasePaths=Object.freeze({
 selection:"internal-test/curated-lab-blind-selection-20261005-18.js",
 settlement:"internal-test/curated-lab-blind-settlement-20261005-18.js",
 documentation:"internal-test/curated-lab-blind-20261005-18.html"
});
function validateFrozen(v){
 if(!v||v.version!==RESTORED_VERSION)throw Error("V1_ORIGINAL_SELECTION_VERSION_MISMATCH");
 if(!v.days||Object.keys(v.days).length!==14)throw Error("V1_ORIGINAL_14_DAY_FREEZE_MISMATCH");
 const expected=ROLES.map(r=>r.id).sort().join(",");
 for(const [date,day] of Object.entries(v.days)){
  const entries=day.entries||[];
  if(entries.map(x=>x.type).sort().join(",")!==expected)throw Error("V1_FOUR_CATEGORIES_MISMATCH:"+date);
  for(const entry of entries){
   if(!Array.isArray(entry.legs)||entry.legs.length!==2)throw Error("V1_TWO_LEGS_MISMATCH:"+date);
   if(entry.legs.some(l=>!l.row||l.row.ft!==null||l.row.ht!==null))throw Error("V1_PREMATCH_OUTCOME_LEAK:"+date);
  }
 }
 return true;
}
function fromFrozen(frozen,day,type){
 validateFrozen(frozen);
 if(!ROLES.some(r=>r.id===type))throw Error("V1_UNKNOWN_ROLE");
 if(!Object.prototype.hasOwnProperty.call(frozen.days,day)){
  throw Error("V1_UNPUBLISHED_DATE: original archived V1.0 has no frozen selection for "+day);
 }
 const item=frozen.days[day].entries.find(x=>x.type===type);
 return {source:"ORIGINAL_V1_FROZEN_SELECTION",date:day,role:type,selected:item||null,
   historicalReplay:true,publishedAtKickoff:false,sourceBlobSha:RESTORED_SELECTION_SHA};
}
function verifySettlement(originalSettlement){
 if(!originalSettlement||originalSettlement.freezeBlobSha!==RESTORED_SELECTION_SHA){
  throw Error("V1_SETTLEMENT_FREEZE_SHA_MISMATCH");
 }
 return true;
}
const CURRENT_RESEARCH_RULESET=Object.freeze({
 version:"CURATED_V1_0_R1_STRUCTURES_20261020",
 ruleModule:"internal-test/curated-v1-original/v1r1_project_rules.cjs",
 analystCount:4,projectCount:5,status:"CONFIGURED_FOR_RESEARCH_NOT_AUTONOMOUS",
 fourRoles:["direction","htft","goals","score"],
 projects:["direction","htft","goals","score_2","score_3"],
 source:"Original V1.0 archived 14-day freeze preserved, current new structural rules are separate and not historical V1.0 results"
});
function activeRoles(){return ROLES.map(x=>({...x}))}
function produceNewDate(){
 throw Error("V1_REPRODUCTION_NOT_ATTESTED: original first-version scorer was archived as frozen results, not as executable source; do not invent a new V1.0 forecast.");
}
module.exports={RESTORED_VERSION,RESTORED_SELECTION_SHA,RESTORED_SETTLEMENT_SHA,ROLES,originalBasePaths,
 validateFrozen,fromFrozen,verifySettlement,activeRoles,produceNewDate,CURRENT_RESEARCH_RULESET};
