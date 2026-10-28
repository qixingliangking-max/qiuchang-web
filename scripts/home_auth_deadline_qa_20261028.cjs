'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const start=app.indexOf('let qcAccessStatePromise=null;');
const end=app.indexOf('function qcMatchHasStarted(',start);
assert.ok(start>0 && end>start);
const snippet=app.slice(start,end);

function harness({session='member',sessionHangs=false,proHangs=false,proError=false}={}){
  const calls={session:0,pro:0,admin:0,bundles:0};
  const callbacks=[];
  const actualSession=session==='member'?{user:{id:'user-one'}}:null;
  const client={
    auth:{
      getSession(){calls.session++;return sessionHangs?
        new Promise(()=>{}):Promise.resolve({data:{session:actualSession},error:null});},
      onAuthStateChange(callback){callbacks.push(callback);return {data:{subscription:{unsubscribe(){}}}};}
    },
    rpc(name){
      if(name!=='has_active_pro_access'){calls.admin++;throw Error('unexpected: '+name);}
      calls.pro++;
      if(proHangs)return new Promise(()=>{});
      if(proError)return Promise.resolve({error:{message:'network down'},data:null});
      return Promise.resolve({data:true,error:null});
    }
  };
  // Let normal already-resolved auth promises finish in the microtask queue.
  // Simulate only stalled deadline timers without 4.5s of actual waiting.
  const mockTimeout=(fn,ms)=>setTimeout(fn,ms>=1800?0:ms);
  const context=vm.createContext({
    window:{qcSupabase:client},
    console,
    sessionStorage:{getItem:()=>null,removeItem(){}},
    Promise,Date,
    setTimeout:mockTimeout,
    clearTimeout
  });
  vm.runInContext(snippet,context);
  const access=(expr='qcGetAccessState()')=>vm.runInContext(expr,context);
  return {access,calls,callbacks,context};
}
test('slow SDK session fails closed with explicit verification-pending result',async()=>{
 const h=harness({sessionHangs:true});
 const state=await h.access();
 assert.equal(state.loggedIn,false);
 assert.equal(state.isPro,false);
 assert.equal(state.verificationPending,true);
 assert.equal(h.calls.pro,0);
 assert.equal(h.calls.session,1);
});
test('hung membership endpoint fails closed and does not query admin',async()=>{
 const h=harness({proHangs:true});
 const state=await h.access();
 assert.equal(state.loggedIn,true);
 assert.equal(state.isPro,false);
 assert.equal(state.verificationPending,true);
 assert.equal(h.calls.pro,1);
 assert.equal(h.calls.admin,0);
});
test('successful entitlement still requires server RPC, and is deduplicated',async()=>{
 const h=harness();
 const results=await Promise.all([h.access(),h.access(),h.access()]);
 assert.equal(results[0].loggedIn,true);
 assert.equal(results[0].isPro,true);
 assert.equal(h.calls.session,1);
 assert.equal(h.calls.pro,1);
 assert.equal(h.calls.admin,0);
});
test('guests never call member or admin RPC',async()=>{
 const h=harness({session:'guest'});
 const state=await h.access();
 assert.equal(state.loggedIn,false);
 assert.equal(state.isPro,false);
 assert.equal(h.calls.pro,0);
});
test('homepage authorization no longer awaits the potentially slow day bootstrap',()=>{
 assert.match(app,/const accessPromise=qcGetAccessState\(\);\s*\/\/ Membership may settle/);
 assert.doesNotMatch(app,/const accessPromise=qcGetAccessState\(false,requestCandidateCurrentBundle\)/);
});
test('slow access ends with actionable retry and never exposes protected models',()=>{
 assert.match(app,/accessDisplayPhase='unavailable';\s*render\(\);\s*return;/);
 assert.match(app,/id="qcRetryMemberStatus"/);
 assert.match(app,/if\(retry\) retry\.onclick=\(\)=>location\.reload\(\)/);
 assert.match(app,/return Boolean\(access\?\.loggedIn && access\?\.isPro\)/);
});
