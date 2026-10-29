'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const begin=code.indexOf('let qcAccessStatePromise=null;');
const end=code.indexOf('function qcMatchHasStarted(',begin);
assert.ok(begin>=0&&end>begin);
const fragment=code.slice(begin,end);

function fixture({hungSession=false,delayedPro=false,guest=false}={}){
  const calls={getSession:0,pro:0,admin:0};
  const callbacks=[];
  const session=guest?null:{user:{id:'test-member'}};
  const client={
    auth:{
      getSession(){calls.getSession++;return hungSession?new Promise(()=>{}):
        Promise.resolve({data:{session},error:null});},
      onAuthStateChange(fn){callbacks.push(fn);
        return {data:{subscription:{unsubscribe(){}}}};}
    },
    rpc(name){
      if(name!=='has_active_pro_access'){calls.admin++;throw Error('unexpected RPC');}
      calls.pro++;
      if(delayedPro&&calls.pro===1)return new Promise(()=>{});
      return Promise.resolve({data:true,error:null});
    }
  };
  const ctx=vm.createContext({
    window:{qcSupabase:client},
    sessionStorage:{getItem(){return null;},removeItem(){}},
    Date,Promise,console,
    setTimeout:(fn,delay)=>setTimeout(fn,delay>=1800?0:delay),
    clearTimeout
  });
  vm.runInContext(fragment,ctx);
  return {
    calls,callbacks,
    access:(force=false)=>vm.runInContext(force?'qcGetAccessState(true)':'qcGetAccessState()',ctx),
    shared:()=>vm.runInContext('qcGetSharedSession()',ctx)
  };
}

test('hung getSession recovers via SDK INITIAL_SESSION without any extra SDK read',async()=>{
  const f=fixture({hungSession:true});
  const outcome=f.access();
  assert.equal(f.callbacks.length,1);
  f.callbacks[0]('INITIAL_SESSION',{user:{id:'test-member'}});
  const verdict=await outcome;
  assert.equal(verdict.isPro,true);
  assert.equal(verdict.loggedIn,true);
  assert.equal(f.calls.getSession,1);
  assert.equal(f.calls.pro,1);
  assert.equal(f.calls.admin,0);
});

test('without a resolved SDK session or event, auth remains fail-closed',async()=>{
  const f=fixture({hungSession:true});
  const result=await f.access();
  assert.equal(result.verificationPending,true);
  assert.equal(result.isPro,false);
  assert.equal(f.calls.pro,0);
});

test('manual retry rechecks the server after a transient Pro timeout',async()=>{
  const f=fixture({delayedPro:true});
  const first=await f.access();
  assert.equal(first.verificationPending,true);
  assert.equal(first.isPro,false);
  const retry=await f.access(true);
  assert.equal(retry.loggedIn,true);
  assert.equal(retry.isPro,true);
  assert.equal(f.calls.getSession,2,'manual retry explicitly rereads the current session');
  assert.equal(f.calls.pro,2,'authorization is checked again on server');
  assert.equal(f.calls.admin,0);
});

test('guests never receive Pro and never call an entitlement RPC',async()=>{
  const f=fixture({guest:true});
  const result=await f.access();
  assert.equal(result.isPro,false);
  assert.equal(f.calls.pro,0);
});

test('the homepage manual retry is in-place, rate-limited, and does not reload',()=>{
  assert.match(code,/async function qcRetryMemberInPlace\(\)/);
  assert.match(code,/await qcApplyMemberAccess\(await qcGetAccessState\(true\),epoch\)/);
  assert.doesNotMatch(code,/qcMemberAutoRetryUsed/);
  assert.match(code,/qcMemberRetryInProgress/);
  assert.match(code,/cards\.__qcRetryMemberAccess=qcRetryMemberInPlace/);
  assert.match(code,/const recoveredPending=Boolean\(session && previousAccess\?\.verificationPending\)/);
  assert.match(code,/overview\.__qcRetryMemberAccess\(\)/);
  assert.doesNotMatch(code,/if\(retry\) retry\.onclick=\(\)=>location\.reload\(\)/);
  assert.match(code,/return Boolean\(access\?\.loggedIn && access\?\.isPro\)/);
});
