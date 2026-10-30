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
 return {ctx,calls,callbacks,access:(force=false)=>vm.runInContext(force?'qcGetAccessState(true)':'qcGetAccessState()',ctx)};
}

test('handoff reads once and a manual recheck can recover a late SDK session',async()=>{
 const member={user:{id:'test-user'}};
 const h=setup({handoff:true,sessions:[null,member]});
 const initial=await h.access();
 assert.equal(initial.isPro,false);
 assert.equal(initial.loggedIn,false);
 assert.equal(h.calls.read,1);
 const second=await h.access(true);
 assert.equal(second.loggedIn,true);
 assert.equal(second.isPro,true);
 assert.equal(h.calls.read,2);
 assert.equal(h.calls.entitlement,1);
});

test('missing session never grants Pro or triggers automatic retries',async()=>{
 const h=setup({handoff:true,sessions:[null,null]});
 const state=await h.access();
 assert.equal(state.loggedIn,false);
 assert.equal(state.isPro,false);
 assert.equal(h.calls.read,1);
 assert.equal(h.calls.entitlement,0);
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
 const pages=['index.html','football.html','jc-match.html','profile.html',
 'register.html','forgot-password.html','reset-password.html','verify.html','match.html',
 'model-record-test.html','league-archive-preview.html'];
 pages.forEach(page=>{
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.equal((html.match(/app\.js\?v=20261030sixfields2/g)||[]).length,1,page);
  assert.doesNotMatch(html,/login\.html\?v=20261024authstable4/,page);
 });
 assert.match(app,/login\.html\?v=20261029authhandoff5/);
 const login=fs.readFileSync(path.join(root,'login.html'),'utf8');
 assert.match(login,/login-fast\.js\?v=20261029netretry2/);
 assert.doesNotMatch(login,/<script[^>]*src="app\.js/);
});

test('league archive is an intentionally isolated guest-light entrypoint',()=>{
  const html=fs.readFileSync(path.join(root,'league.html'),'utf8');
  assert.match(html,/league-entry\.js\?v=20261029authlazy2/);
  assert.doesNotMatch(html,/src="app\.js\?/);
});
