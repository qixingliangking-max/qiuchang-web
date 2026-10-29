'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'data/overview/live/2026-10-29.json'),'utf8'));
const businessDay=()=> '2026-10-30';
const addDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const dateA=app.indexOf('  function qcFootballDateNeedsFinalRefresh(ds){');
const dateB=app.indexOf('  function footballDateText(ds){',dateA);
assert.ok(dateA>0 && dateB>dateA,'date refresh predicate present');
const calendar={qcBeijingBusinessToday:businessDay,qcAddDays:addDays};
vm.createContext(calendar);
vm.runInContext(app.slice(dateA,dateB),calendar);
const scoreA=app.indexOf('function qcIsConfirmedFinal(');
const scoreB=app.indexOf('function jcScoreInfo(',scoreA);
assert.ok(scoreA>0 && scoreB>scoreA);
const settlement={};
vm.createContext(settlement);
vm.runInContext(app.slice(scoreA,scoreB),settlement);
const {qcIsConfirmedFinal, qcApplyOnceFinal}=settlement;
const syntheticPending=(r)=>({
 ...JSON.parse(JSON.stringify(r)),match_status:'2',
 raw:{...(r.raw||{}),sectionsNo999:'',sectionsNo1:'',matchStatusName:'已开售'}
});


test('10:00 rollover continues polling 10/29 while 10/30 is active',()=>{
 assert.equal(calendar.qcFootballDateNeedsFinalRefresh('2026-10-30'),true);
 assert.equal(calendar.qcFootballDateNeedsFinalRefresh('2026-10-29'),true);
 assert.equal(calendar.qcFootballDateNeedsFinalRefresh('2026-10-28'),false);
 assert.equal(calendar.qcFootballDateNeedsFinalRefresh('2026-10-31'),false);
});
test('historical date navigation and cold historical first paint recheck pending yesterday immediately',()=>{
 assert.match(app,/if\(result\.fromHistorySnapshot\)\{[\s\S]*?qcFootballDateNeedsFinalRefresh\(ds\)[\s\S]*?refreshFootballLive\(\)/);
 assert.match(app,/if\(initial\.fromHistorySnapshot\)\{[\s\S]*?qcFootballDateNeedsFinalRefresh\(selectedDate\)[\s\S]*?refreshFootballLive\(\)/);
 assert.match(app,/if\(document\.hidden \|\| !qcFootballDateNeedsFinalRefresh\(selectedDate\)\) return/);
 assert.match(app,/setInterval\(refreshFootballLive,120000\)/);
});
test('one confirmed FT+HT changes precisely one of seven cards while keeping earlier settled rows immutable',()=>{
 assert.equal(fixture.business_date,'2026-10-29');assert.equal(fixture.match_count,7);
 // Preserve two known settled rows but simulate remaining pending fixtures, even
 // after the real static JSON gains a third, fourth or seventh actual result.
 let rows=fixture.rows.map((r,i)=>i<2?JSON.parse(JSON.stringify(r)):syntheticPending(r));
 assert.equal(rows.filter(qcIsConfirmedFinal).length,2);
 const originals=rows.map(r=>JSON.stringify(r));
 const target=rows[2]; // synthetic pending 003, NOT actual match score
 const fresh={id:target.id,match_status:'已结束',raw:{
   sectionsNo999:'3:1',sectionsNo1:'1:0',matchStatusName:'已结束'
 }};
 rows=rows.map(r=>qcApplyOnceFinal(r,r.id===target.id?fresh:undefined));
 assert.equal(rows.filter(qcIsConfirmedFinal).length,3);
 rows.forEach((r,i)=>{if(i!==2)assert.equal(JSON.stringify(r),originals[i]);});
 const after=rows.map(r=>JSON.stringify(r));
 assert.equal(qcApplyOnceFinal(rows[2],fresh),rows[2],'same result cannot replace twice');
 const next=rows[3];
 const fresh4={id:next.id,match_status:'已结束',raw:{
    sectionsNo999:'1:2',sectionsNo1:'0:1',matchStatusName:'已结束'
 }};
 rows=rows.map(r=>qcApplyOnceFinal(r,r.id===next.id?fresh4:undefined));
 assert.equal(rows.filter(qcIsConfirmedFinal).length,4);
 rows.forEach((r,i)=>{if(i!==3)assert.equal(JSON.stringify(r),after[i]);});
});
test('FT-only and non-final in-play updates cannot publish a settled card',()=>{
 const fresh={id:fixture.rows[2].id,match_status:'已结束',raw:{
   sectionsNo999:'3:1',sectionsNo1:'',matchStatusName:'已结束'}};
 const pending=syntheticPending(fixture.rows[2]);
 assert.strictEqual(qcApplyOnceFinal(pending,fresh),pending);
 const inPlay={...fresh,raw:{...fresh.raw,sectionsNo1:'1:0',matchStatusName:'进行中'},match_status:'比赛中'};
 assert.strictEqual(qcApplyOnceFinal(pending,inPlay),pending);
});
test('all seven static IDs are unique, pre-match markets and models remain unchanged',()=>{
 assert.equal(new Set(fixture.rows.map(r=>r.id)).size,7);
 assert.ok(fixture.rows.filter(qcIsConfirmedFinal).length>=2);
 assert.equal(fixture.rows[0].raw.sectionsNo999,'0:1');
 assert.equal(fixture.rows[0].raw.sectionsNo1,'0:1');
 assert.equal(fixture.rows[1].raw.sectionsNo999,'2:4');
 assert.equal(fixture.rows[1].raw.sectionsNo1,'1:2');
 for(const row of fixture.rows){
  assert.equal(row.business_date,'2026-10-29');
  assert.equal(Object.hasOwn(row,'jc_model_outputs'),false);
  assert.equal(Object.hasOwn(row,'qc_pro_predictions'),false);
 }
});
