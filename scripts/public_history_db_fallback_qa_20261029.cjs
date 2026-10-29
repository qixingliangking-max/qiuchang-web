'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'overview-public-rescue.js'),'utf8');
const day='2026-10-28';
const entry=i=>({
 id:'fixture-'+i,match_num:'周三'+String(i).padStart(3,'0'),
 business_date:day,match_status:'已结束',
 match_time:'19:00',league_name:'测试联赛',home_team_name:'主队'+i,away_team_name:'客队'+i,
 raw:{sectionsNo999:'2:1',sectionsNo1:'1:0',matchStatusName:'已结束'},
 jc_model_outputs:[{stage:'FINAL'}]
});
async function scenario({schedule=17,finished=17,dbFinal=true,staticFinal=false,apiReady=true,wrongIds=false}={}){
 const rows=Array.from({length:finished},(_,i)=>entry(i+1));
 const fixtures=Array.from({length:schedule},(_,i)=>({id:'fixture-'+(i+1)}));
 if(wrongIds)fixtures[schedule-1].id='fixture-wrong';
 const calls=[],timers=[],listeners=[],elements={
   jcLiveCards:{textContent:'正在确认登录状态…',dataset:{},innerHTML:''},
   jcYesterdayCards:{textContent:'昨日完整赛果尚在核验',dataset:{},innerHTML:''},
   jcYesterdayMeta:{textContent:'等待完整赛果',dataset:{},innerHTML:''},
   jcDateLabel:{textContent:'读取日期…',setAttribute(){}}
 };
 const pubClient={
  rpc(){throw Error('protected RPC must never be called')},
  from(name){
   calls.push(name);
   if(!['jc_history_overview_snapshots','jc_overview_schedule_snapshots'].includes(name))
     throw Error('private table access '+name);
   return {select(){return this},eq(){return this},async maybeSingle(){
     return {error:null,data:name==='jc_history_overview_snapshots'
       ? {business_date:day,match_count:finished,finished_count:finished,
          is_final:dbFinal,payload:{rows}}
       : {business_date:day,match_count:schedule,payload:{rows:fixtures}}};
   }};
  }
 };
 const ctx={
  window:apiReady?{qcSupabase:pubClient}:{},
  document:{readyState:'loading',getElementById:k=>elements[k]||null,
   addEventListener:(type,fn)=>listeners.push({type,fn})},
  location:{search:'?date=2026-10-29',pathname:'/index.html'},
  Date,Intl,Set,URLSearchParams,console:{warn(){}},
  setTimeout:(fn,ms)=>timers.push({fn,ms}),
  fetch:async url=>{
   if(url==='data/overview/manifest.json')
     return {ok:true,json:async()=>({dates:staticFinal?{[day]:'data/overview/final.json'}:{}})};
   return {ok:true,json:async()=>({business_date:day,match_count:finished,
     finished_count:finished,is_final:true,rows})};
  }
 };
 vm.runInNewContext(source,ctx);
 assert.equal(timers.length,1);
 assert.equal(timers[0].ms,700);
 timers[0].fn();
 for(let i=0;i<30;i++)await Promise.resolve();
 if(!apiReady){
   assert.equal(listeners.length,1);
   ctx.window.qcSupabase=pubClient;
   listeners[0].fn();
   for(let i=0;i<30;i++)await Promise.resolve();
 }
 return {elements,calls};
}

test('when GitHub archive is late, fully verified 17/17 history paints from public DB',async()=>{
 const x=await scenario();
 assert.match(x.elements.jcYesterdayCards.innerHTML,/fixture-17/);
 assert.match(x.elements.jcYesterdayCards.innerHTML,/2-1/);
 assert.equal(x.elements.jcYesterdayMeta.textContent,'10-28 · 17场');
 assert.deepEqual(x.calls,['jc_history_overview_snapshots','jc_overview_schedule_snapshots']);
 assert.equal(x.elements.jcLiveCards.innerHTML,'','member UI never touched');
});

test('wrong 16/16 public history against 17-fixture schedule is never displayed',async()=>{
 const x=await scenario({schedule:17,finished:16});
 assert.equal(x.elements.jcYesterdayCards.innerHTML,'');
 assert.equal(x.elements.jcLiveCards.innerHTML,'');
});

test('DB FINAL flag and exact fixture IDs are independently mandatory',async()=>{
 for(const option of [{dbFinal:false},{wrongIds:true}]){
  const x=await scenario(option);
  assert.equal(x.elements.jcYesterdayCards.innerHTML,'');
 }
});

test('an already-published immutable static FINAL avoids any database requests',async()=>{
 const x=await scenario({staticFinal:true});
 assert.match(x.elements.jcYesterdayCards.innerHTML,/fixture-17/);
 assert.equal(x.calls.length,0);
});

test('the SDK-not-yet-loaded first paint retries once after DOMContentLoaded',async()=>{
 const x=await scenario({apiReady:false});
 assert.match(x.elements.jcYesterdayCards.innerHTML,/fixture-17/);
 assert.equal(x.calls.length,2);
});
