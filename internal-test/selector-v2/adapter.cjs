/* QCDA V2.0 row adapter. Consumes read-only asof_input.sql rows. No results. */
"use strict";
function cleanDirection(input,home,away){
 const s=String(input||"").trim();
 if(["胜","平","负","让胜","让平","让负"].includes(s))return s;
 if(s===String(home||"")+"胜")return "胜";
 if(s===String(away||"")+"胜")return "负";
 if(s===String(home||"")+"负")return "负";
 if(s===String(away||"")+"负")return "胜";
 return null;
}
function toFixture(row){
 const blocked=["ft_score","ht_score","completed_at","match_result","settlement"];
 for(const x of blocked)if(Object.prototype.hasOwnProperty.call(row,x))throw Error("Outcome-bearing data cannot enter V2 fixture: "+x);
 const m={};
 for(const [pool,value] of Object.entries(row.markets||{})){
  if(!["had","hhad","ttg","hafu","crs"].includes(pool)||!value?.odds)continue;
  m[pool]={
   capturedAt:value.capturedAt,
   line:value.line??null,
   odds:Object.fromEntries(Object.entries(value.odds).filter(([k,v])=>
     (pool==="crs"?/^s\d{2}s\d{2}$/.test(k):pool==="hafu"?/^[hda]{2}$/.test(k):pool==="ttg"?/^s[0-7]$/.test(k):/^[hda]$/.test(k))
      &&v!==null&&v!==""&&Number.isFinite(Number(v))&&Number(v)>1).map(([k,v])=>[k,Number(v)]))
  };
 }
 return {
  id:row.fixture_id,num:row.match_num,league:row.league_short_name,
  kickoffAt:row.kickoff_at,decisionAt:row.decision_cutoff,
  model:{isLocked:true,lockedAt:row.locked_at,updatedAt:row.output_updated_at,
   singlePick:cleanDirection(row.single_pick,row.home_team_name,row.away_team_name),
   htftTop1:row.htft_top1,goalCandidates:row.goal_range,topScores:row.top_scores},
  features:row.feature_fetched_at?{capturedAt:row.feature_fetched_at,
   homeGoalsFor:row.home_goals_for,homeGoalsAgainst:row.home_goals_against,
   awayGoalsFor:row.away_goals_for,awayGoalsAgainst:row.away_goals_against,
   homeSample:row.sample_size,awaySample:row.sample_size}:{},
  markets:m
 };
}
module.exports={cleanDirection,toFixture};
