'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const prime=fs.readFileSync(path.join(root,'home-auth-prime.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const start=app.indexOf('let qcAccessStatePromise=null;');
const end=app.indexOf('function qcMatchHasStarted(',start);
assert.ok(start>0&&end>start);
const fragment=app.slice(start,end);
function setup({session={user:{id:'member'}},isPro=true,sessionError=false,proError=false}={}){
 const counts={session:0,entitlement:0},callbacks=[];
 const client={auth:{
  getSession(){counts.session++;return Promise.resolve(sessionError
    ? {error:new Error('offline')}: {data:{session},error:null});},
  onAuthStateChange(fn){callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}};}
 },rpc(name){assert.equal(name,'has_active_pro_access');counts.entitlement++;
   return Promise.resolve(proError?{error:new Error('offline')}:{data:isPro,error:null});}};
 const cards={dataset:{},innerHTML:'',querySelector(){return null;}};
 const meta={textContent:''};
 const ctx=vm.createContext({
  window:{qcSupabase:client},
  document:{getElementById(id){return id==='jcLiveCards'?cards:meta;}},
  location:{pathname:'/index.html',search:''},
  sessionStorage:{getItem(){return null;},removeItem(){}},
  Date,Promise,setTimeout,clearTimeout,encodeURIComponent,console:{warn(){}}
 });
 vm.runInContext(prime,ctx);
 vm.runInContext(fragment,ctx);
 return {counts,cards,meta,ctx,
  early:()=>ctx.window.qcHomeEarlyAccessPromise,
  access:()=>vm.runInContext('qcGetAccessState()',ctx),
  shared:()=>vm.runInContext('qcGetSharedSession()',ctx)};
}
test('member Pro: one session and one server query, reused by app and navigation',async()=>{
 const h=setup();
 const [early,fromApp,session]=await Promise.all([h.early(),h.access(),h.shared()]);
 assert.equal(early.isPro,true);
 assert.equal(fromApp.loggedIn,true);
 assert.equal(session.data.session.user.id,'member');
 assert.equal(h.counts.session,1);
 assert.equal(h.counts.entitlement,1);
 assert.match(h.cards.innerHTML,/会员已验证/);
});
test('guest: one session read, zero Pro queries, login prompt visible',async()=>{
 const h=setup({session:null});
 const state=await h.access();
 assert.equal(state.loggedIn,false);
 assert.equal(state.isPro,false);
 assert.equal(h.counts.session,1);
 assert.equal(h.counts.entitlement,0);
 assert.match(h.cards.innerHTML,/登录后查看今日预测/);
});
test('ordinary account: check entitlement once, never leak Pro',async()=>{
 const h=setup({isPro:false});
 const state=await h.access();
 assert.equal(state.loggedIn,true);
 assert.equal(state.isPro,false);
 assert.equal(h.counts.entitlement,1);
 assert.match(h.cards.innerHTML,/订阅后查看今日预测/);
});
test('server error remains unverified, protected rows stay locked',async()=>{
 const h=setup({proError:true});
 const state=await h.access();
 assert.equal(state.verificationPending,true);
 assert.equal(state.isPro,false);
 assert.equal(h.counts.entitlement,1);
 assert.match(h.cards.innerHTML,/重新验证/);
});
test('session error cannot trigger privileged RPC',async()=>{
 const h=setup({sessionError:true});
 const state=await h.access();
 assert.equal(state.verificationPending,true);
 assert.equal(state.isPro,false);
 assert.equal(h.counts.entitlement,0);
});
test('main auth has no nested retry or duplicate homepage Pro check',()=>{
 assert.match(app,/qcGetSharedSession\(force\)/);
 assert.match(app,/rpc\('has_active_pro_access'\)/);
 assert.doesNotMatch(app.slice(start,end),/sessionAttempts|recentAuthHandoff|attempt<2/);
 assert.doesNotMatch(app,/qcMemberAutoRetryUsed/);
 assert.match(app,/return Boolean\(access\?\.loggedIn && access\?\.isPro\)/);
});
test('lightweight two-step primer loads before app with shared session',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const p=html.indexOf('home-auth-prime.js?v=20261029simpleauth1');
 const a=html.indexOf('app.js?v=20261029simpleauth1');
 assert.ok(p>0&&a>p);
 assert.match(prime,/window\.qcHomeEarlySession=Promise\.resolve\(\)\.then/);
 assert.equal((prime.match(/rpc\('has_active_pro_access'\)/g)||[]).length,1);
 assert.match(app,/const accessPromise=qcGetAccessState\(\);/);
});
