'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const prime=fs.readFileSync(path.join(root,'home-auth-prime.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');

async function runPrime({loggedIn=true,isPro=true,date='2026-10-29'}={}){
 const calls={session:0,access:0,predictions:0,queryDate:null,fields:null};
 const cards={dataset:{},innerHTML:'正在确认登录状态…',querySelector(){return null;}};
 const meta={textContent:'正在确认登录状态…'};
 const chain={
  select(fields){calls.fields=fields;return this;},
  eq(key,day){assert.equal(key,'business_date');calls.queryDate=day;return this;},
  limit(n){assert.equal(n,1);calls.predictions++;return Promise.resolve({data:[{business_date:date,match_count:7,model_count:7,payload:{rows:[{id:'a',jc_model_outputs:[{}]}]}}],error:null});}
 };
 const sdk={
  auth:{async getSession(){calls.session++;return {data:{session:loggedIn?{user:{id:'u1'}}:null},error:null};}},
  async rpc(name){assert.equal(name,'has_active_pro_access');calls.access++;return {data:isPro,error:null};},
  from(name){assert.equal(name,'jc_overview_prediction_snapshots');return chain;}
 };
 const window={qcSupabase:sdk};
 const context={window,document:{getElementById(id){return id==='jcLiveCards'?cards:id==='jcPredictionMeta'?meta:null;}},location:{search:'?date='+date,pathname:'/index.html'},URLSearchParams,Intl,Date,Promise,setTimeout,clearTimeout,encodeURIComponent,console:{warn(){}}};
 vm.runInNewContext(prime,context);
 const record=await window.qcHomeEarlyProSnapshotPromise;
 return {record,calls,meta:meta.textContent,html:cards.innerHTML,window};
}
test('verified Pro starts one date-specific RLS snapshot before main app',async()=>{
 const x=await runPrime();
 assert.equal(x.calls.session,1);assert.equal(x.calls.access,1);
 assert.equal(x.calls.predictions,1);assert.equal(x.calls.queryDate,'2026-10-29');
 assert.match(x.calls.fields,/model_count/);
 assert.equal(x.record.model_count,7);
 assert.equal(x.meta,'会员已验证');
 assert.doesNotMatch(x.html,/上海|竞彩预测|jc_model_outputs/);
});
test('member without Pro never issues protected prediction read',async()=>{
 const x=await runPrime({loggedIn:true,isPro:false});
 assert.equal(x.calls.session,1);assert.equal(x.calls.access,1);
 assert.equal(x.calls.predictions,0);assert.equal(x.record,null);
});
test('guest never issues Pro verdict or protected snapshot query',async()=>{
 const x=await runPrime({loggedIn:false});
 assert.equal(x.calls.session,1);assert.equal(x.calls.access,0);
 assert.equal(x.calls.predictions,0);assert.equal(x.record,null);
});
test('main authorized fast lane completes without waiting on combined bootstrap',async()=>{
 const start=app.indexOf('    if(access.isPro && ds===candidateDate &&\n       window.qcHomeEarlyProSnapshotPromise');
 const end=app.indexOf('    // Server validates Pro entitlement.',start);
 assert.ok(start>0&&end>start,'explicit authorized fast path exists');
 const snippet=app.slice(start,end);
 let reads=0;
 const ctx={
  access:{loggedIn:true,isPro:true},ds:'2026-10-29',candidateDate:'2026-10-29',
  window:{qcHomeEarlyProSnapshotPromise:Promise.resolve({}),qcHomeEarlyProDate:'2026-10-29'},
  async qcFetchProOverviewDate(){reads++;return {data:[{id:'one',jc_model_outputs:[{is_locked:true}]}],fromPredictionSnapshot:true};},
  Array,Promise
 };
 const result=await vm.runInNewContext('(async()=>{'+snippet+'return null;})()',ctx);
 assert.equal(reads,1);assert.equal(result?.data?.[0]?.id,'one');
});
test('main guest never uses member fast path, preserving server gate',async()=>{
 const start=app.indexOf('    if(access.isPro && ds===candidateDate &&\n       window.qcHomeEarlyProSnapshotPromise');
 const end=app.indexOf('    // Server validates Pro entitlement.',start);
 let called=false;
 const result=await vm.runInNewContext('(async()=>{'+app.slice(start,end)+'return null;})()',{
  access:{loggedIn:false,isPro:false},ds:'2026-10-29',candidateDate:'2026-10-29',
  window:{qcHomeEarlyProSnapshotPromise:Promise.resolve({}),qcHomeEarlyProDate:'2026-10-29'},
  async qcFetchProOverviewDate(){called=true;return {data:[]};},Array,Promise
 });
 assert.equal(called,false);assert.equal(result,null);
});
test('homepage script cache-busts both changed first-paint files',()=>{
 assert.match(home,/home-auth-prime\.js\?v=20261029proonesnap1/);
 assert.match(home,/app\.js\?v=20261029proonesnap1/);
 assert.match(app,/key===window\.qcHomeEarlyProDate/);
 assert.match(app,/const immediatePro=await qcFetchProOverviewDate\(ds\)/);
 assert.doesNotMatch(prime,/localStorage\.setItem|sessionStorage\.setItem/);
});
