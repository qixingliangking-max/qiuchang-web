'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const a=app.indexOf('function jcMatchStatusLabel('),b=app.indexOf('function jcShouldFetchLive(',a);
assert.ok(a>0&&b>a,'production score/status functions found');
const sandbox={
  jcApiLiveInfo:()=>({finished:false,started:false,current:'',ht:'',elapsed:0,short:''}),
  console,Date,String,Number,Boolean
};
vm.createContext(sandbox);
vm.runInContext(app.slice(a,b),sandbox);
const {
  qcHasConfirmedFullTime:hasFT,qcIsConfirmedFinal:hasBoth,
  qcApplyOnceFinal:patch,jcScoreInfo:score,jcMatchStatusLabel:label
}=sandbox;
const old=()=>({
  id:'d37e6143-902c-4e6c-81ea-8496e1e6daaf',
  match_num:'周四002',business_date:'2026-10-29',
  home_team_name:'国际图尔库',away_team_name:'赫尔辛基',
  match_status:'2',raw:{sectionsNo999:'',sectionsNo1:'',matchStatusName:''},
  jc_model_outputs:[{direction:'胜/平'}],jc_market_snapshots:[{pool_code:'had'}]
});
const fresh=(ht='',ft='2:4',state='已结束')=>({
  ...old(),match_status:state,
  raw:{sectionsNo999:ft,sectionsNo1:ht,matchStatusName:state}
});
test('real 10/29 002: official FT without HT paints 2-4 finished, not VS',()=>{
 const initial=old(),after=patch(initial,fresh());
 assert.notEqual(after,initial);
 assert.equal(after.raw.sectionsNo999,'2:4');
 assert.equal(after.raw.sectionsNo1,'');
 assert.equal(label(after,'2026-10-30'),'完赛');
 assert.equal(score(after).ft,'2-4');
 assert.equal(score(after).finished,true);
 assert.equal(hasFT(after),true);
 assert.equal(hasBoth(after),false,'HT-based grading remains pending');
 assert.strictEqual(after.jc_model_outputs,initial.jc_model_outputs,'FINAL immutable');
 assert.strictEqual(after.jc_market_snapshots,initial.jc_market_snapshots,'prematch odds immutable');
});
test('already-painted FT without new HT does not trigger another card paint',()=>{
 const after=patch(old(),fresh());
 assert.strictEqual(patch(after,fresh()),after);
});
test('later official HT fills only the missing HT and activates complete settlement',()=>{
 const first=patch(old(),fresh());
 const completed=patch(first,fresh('1:2'));
 assert.notEqual(completed,first);
 assert.equal(completed.raw.sectionsNo999,'2:4');
 assert.equal(completed.raw.sectionsNo1,'1:2');
 assert.equal(hasBoth(completed),true);
 assert.strictEqual(patch(completed,fresh('1:2')),completed);
});
test('in-play score and invalid FT are never promoted to published final',()=>{
 assert.strictEqual(patch(old(),fresh('','2:4','进行中')).match_status,'2');
 assert.strictEqual(patch(old(),fresh('','N/A','已结束')).match_status,'2');
 assert.equal(hasFT(fresh('','2:4','进行中')),false);
});
test('status count and finished filter reflect official FT while full-hit grading awaits HT',()=>{
 const fixtures=[fresh('0:1','0:1'),fresh(),old(),old(),old(),old(),old()];
 assert.equal(fixtures.filter(hasFT).length,2);
 assert.equal(fixtures.filter(hasBoth).length,1);
 assert.match(app,/dateRows\.filter\(qcHasConfirmedFullTime\)\.length\+'场完赛'/);
 assert.match(app,/activeStatus==='finished'\s*\?\s*qcHasConfirmedFullTime\(m\)/);
 const pending=app.indexOf("if(score.finished && !qcIsConfirmedFinal(m))");
 const complete=app.indexOf("if(score.finished){",pending);
 assert.ok(pending>0 && complete>pending);
 assert.match(app,/半场比分待补齐，命中统计核验中/);
});
