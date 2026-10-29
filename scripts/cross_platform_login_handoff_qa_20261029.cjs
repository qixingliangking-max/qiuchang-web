'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const start=app.indexOf('let qcAccessStatePromise=null;');
const end=app.indexOf('function qcMatchHasStarted(',start);
assert.ok(start>=0&&end>start);
const fragment=app.slice(start,end);

function setup({handoff=false,sessions=[null],pro=true}={}){
 const calls={read:0,entitlement:0},callbacks=[];
 const ctx=vm.createContext({
  window:{qcSupabase:{
   auth:{
    getSession(){
     const n=Math.min(calls.read++,sessions.length-1);
     return Promise.resolve({data:{session:sessions[n]},error:null});
    },
    onAuthStateChange(fn){callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}};}
   },
   rpc(name){assert.equal(name,'has_active_pro_access');calls.entitlement++;
     return Promise.resolve({data:pro,error:null});}
  }},
  sessionStorage:{getItem(key){return key==='qc-auth-handoff'&&handoff?String(Date.now()):null;},removeItem(){}},
  console:{warn(){}},Date,Promise,
  setTimeout:(fn,ms)=>setTimeout(fn,ms===4000||ms===4500?0:0),
  clearTimeout
 });
 vm.runInContext(fragment,ctx);
 return {ctx,calls,callbacks,access:()=>vm.runInContext('qcGetAccessState()',ctx)};
}

test('cross-platform login handoff does a truly fresh SDK read after an empty session',async()=>{
 const member={user:{id:'test-user'}};
 const a=setup({handoff:true,sessions:[null,member]});
 const state=await a.access();
 assert.equal(state.isPro,true);
 assert.equal(state.loggedIn,true);
 assert.equal(a.calls.read,2,'must not repeat a cached null promise');
 assert.equal(a.calls.entitlement,1,'server authorization is still mandatory');
});

test('recent login with two empty SDK sessions stays unverified, never becomes guest',async()=>{
 const a=setup({handoff:true,sessions:[null,null]});
 const state=await a.access();
 assert.equal(state.loggedIn,false);
 assert.equal(state.isPro,false);
 assert.equal(state.verificationPending,true);
 assert.equal(a.calls.read,2);
 assert.equal(a.calls.entitlement,0);
});

test('normal guest does not issue repeated SDK reads or ask for Pro',async()=>{
 const a=setup({sessions:[null]});
 const state=await a.access();
 assert.equal(state.isPro,false);
 assert.equal(state.loggedIn,false);
 assert.equal(a.calls.read,1);
 assert.equal(a.calls.entitlement,0);
});

test('valid member without handoff verifies once and keeps role gated on RPC',async()=>{
 const a=setup({sessions:[{user:{id:'u'}}],pro:false});
 const state=await a.access();
 assert.equal(state.loggedIn,true);
 assert.equal(state.isPro,false);
 assert.equal(a.calls.entitlement,1);
});

test('all public pages load one synchronized app and all guest entries use current login URL',()=>{
 const pages=['index.html','football.html','league.html','jc-match.html','profile.html',
 'register.html','forgot-password.html','reset-password.html','verify.html','match.html',
 'model-record-test.html','league-archive-preview.html'];
 pages.forEach(page=>{
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.equal((html.match(/app\.js\?v=20261029crossauth5/g)||[]).length,1,page);
  assert.doesNotMatch(html,/login\.html\?v=20261024authstable4/,page);
 });
 assert.match(app,/login\.html\?v=20261029authhandoff5/);
 const login=fs.readFileSync(path.join(root,'login.html'),'utf8');
 assert.match(login,/login-fast\.js\?v=20261029netretry2/);
 assert.doesNotMatch(login,/<script[^>]*src="app\.js/);
});
