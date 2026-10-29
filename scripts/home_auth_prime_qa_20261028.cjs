'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const primer=fs.readFileSync(path.join(root,'home-auth-prime.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const begin=app.indexOf('let qcAccessStatePromise=null;');
const end=app.indexOf('function qcMatchHasStarted(',begin);
assert.ok(begin>0&&end>begin,'shared authorization implementation exists');
const fragment=app.slice(begin,end);

function fixture({member=true}={}){
  const calls={sessions:0,entitlements:0,admin:0};
  const events=[];
  const client={
    auth:{
      async getSession(){calls.sessions++;return {data:{session:member?{user:{id:'member-one'}}:null},error:null};},
      onAuthStateChange(fn){events.push(fn);return {data:{subscription:{unsubscribe(){}}}};}
    },
    async rpc(name){
      if(name!=='has_active_pro_access'){calls.admin++;throw Error('unexpected RPC '+name);}
      calls.entitlements++;
      return {data:true,error:null};
    }
  };
  const ctx=vm.createContext({
    window:{qcSupabase:client},
    document:{getElementById:id=>id==='jcLiveCards'?{}:null},
    sessionStorage:{getItem:()=>null,removeItem(){}},
    Date,Promise,console,setTimeout,clearTimeout
  });
  vm.runInContext(primer,ctx);
  const initial=ctx.window.qcHomeEarlySession;
  assert.ok(initial && typeof initial.then==='function','early standalone script primes a promise');
  vm.runInContext(fragment,ctx);
  return {calls,events,ctx,initial,access:()=>vm.runInContext('qcGetAccessState()',ctx),
    shared:()=>vm.runInContext('qcGetSharedSession()',ctx)};
}

test('homepage early script starts SDK read without running any entitlement checks or model fetching',async()=>{
  // Analyze executable source only; documentation comments may correctly
  // mention the server entitlement API without invoking it.
  const executable=primer.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
  assert.doesNotMatch(executable,/has_active_pro_access|qc_model_outputs|jc_model_outputs|qcFetchOverviewBootstrap/);
  const f=fixture();
  await f.initial;
  assert.equal(f.calls.sessions,1);
  assert.equal(f.calls.entitlements,0);
  assert.equal(f.calls.admin,0);
});

test('main app adopts primed session and queries exactly one server membership RPC',async()=>{
  const f=fixture();
  const [a,b,c]=await Promise.all([f.access(),f.shared(),f.access()]);
  assert.equal(a.isPro,true);
  assert.equal(c.loggedIn,true);
  assert.equal(b.data.session.user.id,'member-one');
  assert.equal(f.calls.sessions,1,'no duplicate session getSession after early prime');
  assert.equal(f.calls.entitlements,1);
  assert.equal(f.calls.admin,0);
});

test('guest remains unprivileged and never invokes membership or admin RPC',async()=>{
  const f=fixture({member:false});
  const a=await f.access();
  assert.equal(a.isPro,false);
  assert.equal(a.loggedIn,false);
  assert.equal(f.calls.sessions,1);
  assert.equal(f.calls.entitlements,0);
});

test('only homepage gets the lightweight prime and it runs before app.js',()=>{
  const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const primeAt=home.indexOf('src="home-auth-prime.js?v=20261028homeauthfast1"');
  const clientAt=home.indexOf('src="supabase-client.js?');
  const appAt=home.indexOf('src="app.js?v=20261029crossauth5&amp;home=20261029slim1"');
  assert.ok(clientAt>0&&primeAt>clientAt&&appAt>primeAt);
  const detail=fs.readFileSync(path.join(root,'jc-match.html'),'utf8');
  assert.doesNotMatch(detail,/home-auth-prime\.js/);
});

test('verified membership changes the placeholder before waiting on fixture timeout',()=>{
  const homeStart=app.indexOf('async function loadJcFrontend(){');
  const authAt=app.indexOf('accessPromise.then(earlyAccess=>',homeStart);
  const fixtureWaitAt=app.indexOf('initialCurrent=await qcAuthDeadline(',homeStart);
  assert.ok(authAt>homeStart&&fixtureWaitAt>authAt);
  assert.match(app,/earlyAccess\?\.isPro/);
  assert.match(app,/会员已验证，正在载入今日赛事/);
  assert.match(app,/cards\.dataset\.qcAuthPaintReady='1'/);
  assert.match(app,/let access=qcLastAccessState\|\|/);
  assert.match(app,/return Boolean\(access\?\.loggedIn && access\?\.isPro\)/);
});
