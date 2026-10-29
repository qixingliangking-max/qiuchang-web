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

function fixture({member=true,sessionHangs=false}={}){
  const calls={sessions:0,entitlements:0,admin:0};
  const events=[];
  const client={
    auth:{
      async getSession(){
        calls.sessions++;
        if(sessionHangs)return new Promise(()=>{});
        return {data:{session:member?{user:{id:'member-one'}}:null},error:null};
      },
      onAuthStateChange(fn){events.push(fn);return {data:{subscription:{unsubscribe(){}}}};}
    },
    async rpc(name){
      if(name!=='has_active_pro_access'){calls.admin++;throw Error('unexpected RPC '+name);}
      calls.entitlements++;
      return {data:true,error:null};
    }
  };
  const cards={dataset:{},innerHTML:'',querySelector(){return null}};
  const meta={textContent:''};
  const ctx=vm.createContext({
    window:{qcSupabase:client},
    document:{getElementById(id){return id==='jcLiveCards'?cards:id==='jcPredictionMeta'?meta:null;}},
    location:{pathname:'/index.html',search:''},
    sessionStorage:{getItem:()=>null,removeItem(){}},
    Date,Promise,console,setTimeout,clearTimeout
  });
  vm.runInContext(primer,ctx);
  const initial=ctx.window.qcHomeEarlySession;
  assert.ok(initial && typeof initial.then==='function','early standalone script primes a promise');
  vm.runInContext(fragment,ctx);
  return {calls,events,ctx,cards,meta,initial,access:()=>vm.runInContext('qcGetAccessState()',ctx),
    shared:()=>vm.runInContext('qcGetSharedSession()',ctx)};
}

test('homepage begins one SDK read and one server entitlement before app loads',async()=>{
  // Analyze executable source only; documentation comments may correctly
  // mention the server entitlement API without invoking it.
  const executable=primer.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
  assert.doesNotMatch(executable,/jc_model_outputs|qc_model_outputs|qcFetchOverviewBootstrap/);
  const f=fixture();
  await f.ctx.window.qcHomeEarlyAccessPromise;
  assert.equal(f.calls.sessions,1);
  assert.equal(f.calls.entitlements,1);
  assert.equal(f.calls.admin,0);
  assert.match(f.cards.innerHTML,/会员已验证/);
  assert.equal(f.meta.textContent,'会员已验证');
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
  const primeAt=home.indexOf('src="home-auth-prime.js?v=20261029authprime3"');
  const clientAt=home.indexOf('src="supabase-client.js?');
  const appAt=home.indexOf('src="app.js?v=20261029homeslim3"');
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

test('INITIAL_SESSION event recovers stalled iOS/Android SDK session without waiting 2.5 seconds',async()=>{
 const f=fixture({sessionHangs:true});
 assert.ok(f.events.length>0,'auth events must be registered before SDK read');
 const statePromise=f.ctx.window.qcHomeEarlyAccessPromise;
 f.events[0]('INITIAL_SESSION',{user:{id:'member-one'}});
 const state=await statePromise;
 assert.equal(state.loggedIn,true);
 assert.equal(state.isPro,true);
 assert.equal(f.calls.sessions,1);
 assert.equal(f.calls.entitlements,1);
 assert.match(f.cards.innerHTML,/会员已验证/);
});

test('SIGNED_OUT never grants membership after an in-flight auth bootstrap',async()=>{
 const f=fixture({sessionHangs:true});
 f.events[0]('SIGNED_OUT',null);
 const state=await f.ctx.window.qcHomeEarlyAccessPromise;
 assert.equal(state.loggedIn,false);
 assert.equal(state.isPro,false);
 assert.equal(f.calls.entitlements,0);
});
