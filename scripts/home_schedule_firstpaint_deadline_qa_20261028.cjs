'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const start=code.indexOf('  let initialCurrent;');
const end=code.indexOf('  const previousResult={data:[],error:null,historyFinal:false};',start);
assert.ok(start>0&&end>start,'homepage first-day fallback implementation exists');
const snippet=code.slice(start,end);

async function execute({primary='timed-out',staticData=true}={}){
  const calls={primary:0,static:0};
  const expectedPublic={data:[{id:'public-fixture',home_team_name:'公开主队',away_team_name:'公开客队'}],error:null,fromScheduleSnapshot:true};
  const context={
    Promise,console,Error,
    initialDate:'2026-10-28',today:'2026-10-28',
    candidatePublicSchedulePromise:staticData?Promise.resolve(expectedPublic):new Promise(()=>{}),
    fetchOverviewDateReady(){calls.primary++;return primary==='resolved'
      ? Promise.resolve({data:[{id:'normal-day'}],error:null})
      :new Promise(()=>{});},
    async qcAuthDeadline(p,timeoutMs){
      if(timeoutMs===5500 && primary==='timed-out')return {timeout:true,value:null};
      if(timeoutMs===1500 && !staticData)return {timeout:true,value:null};
      return {timeout:false,value:await p};
    }
  };
  const result=await vm.runInNewContext('(async()=>{'+snippet+' return currentResult; })()',context);
  return {result,calls};
}
test('delayed initial day switches to already-published PUBLIC static day',async()=>{
  const {result,calls}=await execute();
  assert.equal(calls.primary,1);
  assert.equal(result.data[0].id,'public-fixture');
  assert.equal(result.fromScheduleSnapshot,true);
  assert.equal(JSON.stringify(result).includes('jc_model_outputs'),false);
});
test('fully stalled day does not leave a never-resolving homepage promise',async()=>{
  const {result}=await execute({staticData:false});
  assert.equal(result.data.length,0);
  assert.match(result.error.message,/超时/);
});
test('normal fast day is unchanged and does not need static fallback',async()=>{
  const {result}=await execute({primary:'resolved'});
  assert.equal(result.data[0].id,'normal-day');
});
test('first-paint cannot bypass the independent server membership check',()=>{
  assert.match(code,/const accessPromise=qcGetAccessState\(\);/);
  assert.match(code,/const initialCurrent=|let initialCurrent;/);
  assert.match(code,/if\(access\.verificationPending\)\{\s*accessDisplayPhase='unavailable'/);
  assert.match(code,/return Boolean\(access\?\.loggedIn && access\?\.isPro\)/);
});
