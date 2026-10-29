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

function fixture({member=true,pro=true,proError=false,handoff=false,sessions=null}={}){
  const calls={sessions:0,entitlements:0,admin:0};
  const events=[];
  const client={
    auth:{
      async getSession(){
      const n=calls.sessions++;
      const session=sessions?sessions[Math.min(n,sessions.length-1)]:
        member?{user:{id:'member-one'}}:null;
      return {data:{session},error:null};
    },
      onAuthStateChange(fn){events.push(fn);return {data:{subscription:{unsubscribe(){}}}};}
    },
    async rpc(name){
      if(name!=='has_active_pro_access'){calls.admin++;throw Error('unexpected RPC '+name);}
      calls.entitlements++;
      return proError?{data:null,error:{message:'temporary error'}}:{data:pro,error:null};
    }
  };
  const cards={textContent:'正在确认登录状态…',dataset:{},
    innerHTML:'',querySelector(){return null;}};
  const meta={textContent:'正在确认登录状态…'};
  const ctx=vm.createContext({
    window:{qcSupabase:client},
    document:{getElementById:id=>id==='jcLiveCards'?cards:
      id==='jcPredictionMeta'?meta:null},
    location:{pathname:'/index.html',search:''},
    sessionStorage:{getItem:key=>handoff&&key==='qc-auth-handoff'?String(Date.now()):null,
      removeItem(){}},
    Date,Promise,console,setTimeout,clearTimeout,encodeURIComponent
  });
  vm.runInContext(primer,ctx);
  const initial=ctx.window.qcHomeEarlySession;
  assert.ok(initial && typeof initial.then==='function','early standalone script primes a promise');
  vm.runInContext(fragment,ctx);
  return {calls,events,ctx,initial,cards,meta,access:()=>vm.runInContext('qcGetAccessState()',ctx),
    shared:()=>vm.runInContext('qcGetSharedSession()',ctx)};
}

test('lightweight homepage pre-verifies Pro on server without fetching protected rows',async()=>{
  const executable=primer.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
  assert.doesNotMatch(executable,/qc_model_outputs|jc_model_outputs|qcFetchOverviewBootstrap|prediction_snapshots/);
  assert.match(executable,/rpc\('has_active_pro_access'\)/);
  const f=fixture();
  const verified=await f.ctx.window.qcHomeEarlyAccess;
  assert.equal(verified.isPro,true);
  assert.equal(f.calls.sessions,1);
  assert.equal(f.calls.entitlements,1);
  assert.equal(f.calls.admin,0);
  assert.equal(f.meta.textContent,'会员已验证');
  assert.match(f.cards.innerHTML,/会员已验证/);
});

test('main app adopts early server authorization with no duplicate membership RPC',async()=>{
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
  const primeAt=home.indexOf('src="home-auth-prime.js?v=20261029earlymember1"');
  const clientAt=home.indexOf('src="supabase-client.js?');
  const appAt=home.indexOf('src="app.js?v=20261029crossauth5&amp;home=20261029memberfast1"');
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

test('already-logged-in ordinary account gets no Pro authorization',async()=>{
  const f=fixture({pro:false});
  const state=await f.access();
  assert.equal(state.loggedIn,true);
  assert.equal(state.isPro,false);
  assert.equal(f.calls.entitlements,1);
  assert.equal(f.calls.sessions,1);
});

test('Pro RPC failure keeps protected content closed without double RPC on first frame',async()=>{
  const f=fixture({proError:true});
  const state=await f.access();
  assert.equal(state.loggedIn,true);
  assert.equal(state.verificationPending,true);
  assert.equal(state.isPro,false);
  assert.equal(f.calls.entitlements,1);
  assert.equal(f.calls.sessions,1);
});

test('recent login handoff ignores early null and retries a genuinely fresh SDK session',async()=>{
  const f=fixture({handoff:true,sessions:[null,{user:{id:'member-one'}}]});
  const state=await f.access();
  assert.equal(state.loggedIn,true);
  assert.equal(state.isPro,true);
  assert.equal(f.calls.sessions,2);
  assert.equal(f.calls.entitlements,1);
});
