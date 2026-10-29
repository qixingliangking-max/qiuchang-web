'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const start=code.indexOf('  let initialCurrent;');
const end=code.indexOf('  const previousResult={data:[],error:null,historyFinal:false};',start);
assert.ok(start>0&&end>start);
const snippet=code.slice(start,end);

async function execute({staticMode='ready',primary='timed-out',sameDate=true}={}){
  const calls={primary:0,public:0};
  const result={data:[{id:'public-fixture',home_team_name:'主队',away_team_name:'客队'}],
    error:null,fromScheduleSnapshot:true};
  const publicPromise=staticMode==='ready'?Promise.resolve(result)
    :staticMode==='missing'?Promise.resolve({data:[],error:null})
    :new Promise(()=>{});
  const ctx={
    Promise,console,Error,Array,window:{qcHomeEarlyProValidatedRecord:null},
    initialDate:sameDate?'2026-10-29':'2026-10-28',
    candidateDate:'2026-10-29',today:'2026-10-29',
    candidatePublicSchedulePromise:publicPromise,
    fetchOverviewDateReady(){calls.primary++;
      return primary==='resolved'?Promise.resolve({data:[{id:'full-day'}],error:null})
        :new Promise(()=>{});},
    async qcAuthDeadline(p,ms){
      if(ms===1600 && staticMode==='stalled')
        return {timeout:true,value:null};
      if(ms===5500 && primary==='timed-out')
        return {timeout:true,value:null};
      if(ms===1500 && staticMode==='stalled')
        return {timeout:true,value:null};
      return {timeout:false,value:await p};
    }
  };
  const response=await vm.runInNewContext('(async()=>{'+snippet+
    'return currentResult;})()',ctx);
  return {response,calls};
}

test('healthy published PUBLIC day paints without ever requesting the heavy bootstrap',async()=>{
 const {response,calls}=await execute();
 assert.equal(calls.primary,0);
 assert.equal(response.data[0].id,'public-fixture');
 assert.equal(response.fromScheduleSnapshot,true);
 assert.equal(JSON.stringify(response).includes('jc_model_outputs'),false);
});

test('missing static day falls back to the original full-day source',async()=>{
 const {response,calls}=await execute({staticMode:'missing',primary:'resolved'});
 assert.equal(calls.primary,1);
 assert.equal(response.data[0].id,'full-day');
});

test('stalled static day and full fallback terminate with a safe error',async()=>{
 const {response,calls}=await execute({staticMode:'stalled'});
 assert.equal(calls.primary,1);
 assert.equal(response.data.length,0);
 assert.match(response.error.message,/超时/);
});

test('historical-date path still invokes the existing source',async()=>{
 const {response,calls}=await execute({sameDate:false,primary:'resolved'});
 assert.equal(calls.primary,1);
 assert.equal(response.data[0].id,'full-day');
});

test('first paint cannot bypass server membership verification',()=>{
 assert.match(code,/const accessPromise=qcGetAccessState\(\);/);
 assert.match(code,/const fastPublic=initialDate===candidateDate/);
 assert.match(code,/if\(access\.verificationPending\)\{/);
 assert.match(code,/return Boolean\(access\?\.loggedIn && access\?\.isPro\)/);
 assert.match(code,/window\.qcHomeEarlyAccessPromise/);
});
