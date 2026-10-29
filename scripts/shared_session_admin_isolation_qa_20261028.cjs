'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const begin=source.indexOf('let qcAccessStatePromise=null;');
const end=source.indexOf('function qcMatchHasStarted(',begin);
assert.ok(begin>0&&end>begin,'access block found');
const fragment=source.slice(begin,end);
function create({member=true}={}){
  const callbacks=[];
  const calls={getSession:0,pro:0,otherRPC:0};
  const client={auth:{
    onAuthStateChange(fn){callbacks.push(fn)},
    async getSession(){calls.getSession++;return {data:{session:member?{user:{id:'member-test'}}:null},error:null}}
  },async rpc(name){
    if(name==='has_active_pro_access'){calls.pro++;return {data:true,error:null}}
    calls.otherRPC++;throw Error('unapproved RPC '+name);
  }};
  const context=vm.createContext({
    window:{qcSupabase:client},sessionStorage:{getItem:()=>null,removeItem(){}},console,Date,Promise,setTimeout,clearTimeout
  });
  vm.runInContext(fragment,context);
  return {callbacks,ctx:context,client,calls,
    read:()=>vm.runInContext('qcGetSharedSession()',context),
    access:()=>vm.runInContext('qcGetAccessState()',context)};
}
test('concurrent widgets share exactly one initial auth.getSession',async()=>{
  const h=create();
  const records=await Promise.all(Array.from({length:12},()=>h.read()));
  assert.equal(h.calls.getSession,1);
  assert.equal(h.callbacks.length,1,'one central observer');
  assert.ok(records.every(x=>x.data.session.user.id==='member-test'));
});
test('entitlement uses one server result for all concurrent readers',async()=>{
  const h=create();
  const [a,b,c]=await Promise.all([h.access(),h.access(),h.access()]);
  assert.deepEqual([a.isPro,b.isPro,c.isPro],[true,true,true]);
  assert.equal(h.calls.getSession,1);
  assert.equal(h.calls.pro,1);
  assert.equal(h.calls.otherRPC,0);
});
test('membership always requires server RPC even with a bootstrap hint',async()=>{
  const h=create();
  h.ctx.bundlePromise=Promise.resolve({is_pro:true});
  const access=await vm.runInContext('qcGetAccessState(false,bundlePromise)',h.ctx);
  assert.equal(access.isPro,true);
  assert.equal(h.calls.getSession,1);
  assert.equal(h.calls.pro,1);
});
test('guest never executes pro or admin queries',async()=>{
  const h=create({member:false});
  const state=await h.access();
  assert.equal(state.loggedIn,false);
  assert.equal(state.isPro,false);
  assert.equal(h.calls.pro,0);
  assert.equal(h.calls.otherRPC,0);
});
test('SDK signed-out event updates shared session with no new auth lock',async()=>{
  const h=create();
  await h.read();
  h.callbacks[0]('SIGNED_OUT',null);
  const later=await h.read();
  assert.equal(later.data.session,null);
  assert.equal(h.calls.getSession,1);
});
test('same-user token refresh does not repeat a checked membership RPC',async()=>{
  const h=create();
  await h.access();
  assert.equal(h.calls.pro,1);
  const start=source.indexOf('let qcAuthRecoveryBound=false;');
  const end=source.indexOf('async function setupAuthNav()',start);
  assert.ok(start>0&&end>start);
  vm.runInContext(source.slice(start,end),h.ctx);
  vm.runInContext('setupAuthStateRecovery()',h.ctx);
  assert.equal(h.callbacks.length,2);
  for(const callback of h.callbacks) callback('TOKEN_REFRESHED',{user:{id:'member-test'}});
  const repeat=await h.access();
  assert.equal(repeat.isPro,true);
  assert.equal(h.calls.pro,1,'token refresh must not invalidate unchanged user');
  for(const callback of h.callbacks) callback('SIGNED_OUT',null);
  const guest=await h.access();
  assert.equal(guest.isPro,false,'signed-out user must not retain membership');
});
test('legacy admin functions and RPCs absent from public bundle',()=>{
  assert.doesNotMatch(source,/function qcAdminSession\(/);
  assert.doesNotMatch(source,/async function setupAdmin(?:Users|Codes|Data|Logs)?\(/);
  assert.doesNotMatch(source,/admin_dashboard_stats|admin_system_activity|admin_user_overview/);
  const pages=['index.html','football.html','league.html','jc-match.html','profile.html',
    'register.html','forgot-password.html','reset-password.html','verify.html','match.html',
    'model-record-test.html','league-archive-preview.html'];
  for(const page of pages){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    assert.match(html,/src="app\.js\?v=20261029proonesnap1"/,page);
  }
});
test('dedicated admin pages keep standalone entry scripts',()=>{
  for(const [html,js] of Object.entries({'admin.html':'admin-home.js','admin-users.html':'admin-users.js',
    'admin-codes.html':'admin-operations.js','admin-data.html':'admin-operations.js',
    'admin-logs.html':'admin-operations.js'})){
    const text=fs.readFileSync(path.join(root,html),'utf8');
    assert.match(text,new RegExp('src="'+js.replace('.','\\.')+'\\?'));
    assert.doesNotMatch(text,/src="app\.js/);
  }
});
