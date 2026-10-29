'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const prime=fs.readFileSync(path.join(root,'home-auth-prime.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const model={stage:'FINAL',is_locked:true,is_current:true,direction:'主队不败',single_pick:'胜',goal_range:'2球｜3球',htft_top1:'胜/胜',htft_top2:'平/胜'};
const rows=['001','002'].map((n,i)=>({
 id:'fixture-'+n,match_num:'周四'+n,business_date:'2026-10-29',
 match_date:'2026-10-29',match_time:i?'22:30:00':'20:15:00',
 kickoff_at:'2026-10-29T12:15:00+00:00',
 home_team_name:'主队'+n,away_team_name:'客队'+n,league_short_name:'亚冠乙',
 jc_market_snapshots:[{pool_code:'had'}],jc_model_outputs:[model],raw:{}
}));
function harness({session=true,isPro=true,day='2026-10-29',snapshot=null,deferSnapshot=false}={}){
 let release,authEvent,lookupCount=0,sessionCount=0,rpcCount=0;
 const data=snapshot===null?{business_date:day,match_count:2,model_count:2,payload:{rows}}:snapshot;
 const response={data:isPro?[data]:[],error:null};
 const gate=deferSnapshot?new Promise(resolve=>{release=()=>resolve(response);}):Promise.resolve(response);
 const cards={dataset:{},innerHTML:'正在确认登录状态…',
  querySelector(){return null;}};
 const meta={textContent:'正在确认登录状态…'};
 const sdk={
  auth:{getSession(){sessionCount++;return Promise.resolve({data:{session:session?{user:{id:'u1'}}:null},error:null});},
    onAuthStateChange(fn){authEvent=fn;return {data:{subscription:{unsubscribe(){}}}};}},
  rpc(n){assert.equal(n,'has_active_pro_access');rpcCount++;return Promise.resolve({data:isPro,error:null});},
  from(n){assert.equal(n,'jc_overview_prediction_snapshots');return {
    select(){return this;},eq(k,v){assert.equal(k,'business_date');assert.equal(v,day);return this;},
    limit(v){assert.equal(v,1);lookupCount++;return gate;}
  };}
 };
 const window={qcSupabase:sdk};
 const ctx=vm.createContext({window,document:{
  getElementById(id){return id==='jcLiveCards'?cards:id==='jcPredictionMeta'?meta:null;}},
  location:{search:'?date='+day,pathname:'/index.html'},URLSearchParams,Intl,Date,Promise,setTimeout,clearTimeout,encodeURIComponent,
  console:{warn(){}}});
 vm.runInContext(prime,ctx,{timeout:3000});
 const flush=async()=>{await window.qcHomeEarlyProSnapshotPromise;for(let i=0;i<8;i++)await Promise.resolve();};
 return {window,cards,meta,flush,release,signOut:()=>authEvent('SIGNED_OUT',null),
  calls:()=>({session:sessionCount,rpc:rpcCount,prediction:lookupCount})};
}
test('verified member sees complete FINAL table with app.js and DOMContentLoaded ABSENT',async()=>{
 const h=harness();await h.flush();
 assert.equal(h.calls().session,1);assert.equal(h.calls().rpc,1);assert.equal(h.calls().prediction,1);
 assert.equal(h.cards.dataset.qcEarlyProPainted,'1');
 assert.equal((h.cards.innerHTML.match(/<tr class="jc-overview-row"/g)||[]).length,2);
 assert.match(h.cards.innerHTML,/jc-choice-primary/);
 assert.match(h.cards.innerHTML,/胜/);assert.match(h.cards.innerHTML,/2球/);
 assert.equal(h.meta.textContent,'会员已验证 · 2场');
 assert.ok(h.window.qcHomeEarlyProValidatedRecord);
 assert.ok(h.window.qcHomeProFirstPaintAt>0);
});
test('an unverified member cannot see any protected model before the response',async()=>{
 const h=harness({deferSnapshot:true});
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.equal(h.cards.dataset.qcEarlyProPainted,undefined);
 assert.doesNotMatch(h.cards.innerHTML,/jc-overview-row|胜\/胜|2球/);
 h.release();await h.flush();
 assert.equal(h.cards.dataset.qcEarlyProPainted,'1');
});
test('guest makes no protected request; non-Pro reads zero RLS rows and never paints',async()=>{
 for(const state of [{session:false},{session:true,isPro:false}]){
  const h=harness(state);await h.flush();
  assert.equal(h.calls().prediction,state.session===false?0:1);
  assert.equal(h.cards.dataset.qcEarlyProPainted,undefined);
  assert.ok(!h.window.qcHomeEarlyProValidatedRecord);
 }
});
test('incomplete, non-FINAL or mismatched date snapshots never get painted',async()=>{
 const bad=[
  {business_date:'2026-10-29',match_count:2,model_count:1,payload:{rows}},
  {business_date:'2026-10-30',match_count:2,model_count:2,payload:{rows}},
  {business_date:'2026-10-29',match_count:2,model_count:2,payload:{rows:[rows[0],rows[0]]}},
  {business_date:'2026-10-29',match_count:2,model_count:2,payload:{rows:rows.map(r=>({...r,jc_model_outputs:[{...model,is_locked:false}]}))}}
 ];
 for(const snap of bad){const h=harness({snapshot:snap});await h.flush();assert.notEqual(h.cards.dataset.qcEarlyProPainted,'1');}
});
test('signing out while protected request is in flight blocks rendering',async()=>{
 const h=harness({deferSnapshot:true});for(let i=0;i<8;i++)await Promise.resolve();
 h.signOut();h.release();await h.flush();
 assert.notEqual(h.cards.dataset.qcEarlyProPainted,'1');
 assert.ok(!h.window.qcHomeEarlyProValidatedRecord);
});
test('all server-provided fixture text is HTML-escaped before painting',async()=>{
 const evil={...rows[0],home_team_name:'<img src=x onerror=alert(1)>'};
 const h=harness({snapshot:{business_date:'2026-10-29',match_count:2,model_count:2,payload:{rows:[evil,rows[1]]}}});
 await h.flush();assert.equal(h.cards.dataset.qcEarlyProPainted,'1');
 assert.doesNotMatch(h.cards.innerHTML,/<img src=x/);
 assert.match(h.cards.innerHTML,/&lt;img/);
});
test('main app takes over already visible verified table without a loading reset',()=>{
 assert.match(app,/window\.qcHomeEarlyProValidatedRecord/);
 assert.match(app,/cards\.dataset\.qcEarlyProPainted==='1'/);
 assert.match(app,/if\(!alreadyVisible\) qcReconcileOverviewTable/);
 assert.match(app,/const fastRecord=window\.qcHomeEarlyProValidatedRecord/);
});
test('homepage primer runs BEFORE large app and all pages share one cached app.js',()=>{
 const p=html.indexOf('home-auth-prime.js?v=20261029parallelrls4');
 const a=html.indexOf('app.js?v=20261030ftpartial1');
 assert.ok(p>0&&a>p);
 const pages=['index.html','football.html','jc-match.html','profile.html','register.html','forgot-password.html','reset-password.html','verify.html','match.html','model-record-test.html','league-archive-preview.html'];
 for(const page of pages)assert.match(fs.readFileSync(path.join(root,page),'utf8'),/app\.js\?v=20261030ftpartial1/);
 assert.doesNotMatch(prime,/localStorage\.setItem|sessionStorage\.setItem/);
});