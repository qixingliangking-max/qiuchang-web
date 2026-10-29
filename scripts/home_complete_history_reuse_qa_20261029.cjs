'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const a=source.indexOf('  async function fetchOverviewDatePreferred(ds){');
const b=source.indexOf('  function preserveOverviewStaticData(',a);
assert.ok(a>0&&b>a,'production date loader found');
const fn=source.slice(a,b);
const day='2026-10-28',today='2026-10-29';
const makeRows=()=>[1,2].map(n=>({id:String(n),business_date:day,finished:true}));
async function check({pro=false,rows=makeRows(),count=2,finishedCount=2,final=true}={}){
 const calls={frozen:0,review:0};
 const history=new Map([[day,{data:rows,matchCount:count,finishedCount,isFinal:final}]]);
 const frozen={data:[{id:'frozen'}],error:null,historyFinal:true};
 const context={today,access:{isPro:pro,loggedIn:pro},qcHistoryOverviewRowsCache:history,
   jcBusinessDate:r=>r.business_date,jcScoreInfo:r=>({finished:Boolean(r.finished)}),
   async qcFetchFrozenOverviewDate(){calls.frozen++;return frozen;},
   async fetchHistoryReviewDateReady(){calls.review++;return {data:[],error:null};},
   window:{},console,Date,Number,Array};
 vm.createContext(context);
 vm.runInContext(fn,context);
 const result=await vm.runInContext('fetchOverviewDatePreferred('+JSON.stringify(day)+')',context);
 return {calls,result,rows};
}
test('guest reuses verified complete final yesterday from in-memory review with zero new requests',async()=>{
 const x=await check();
 assert.equal(x.calls.frozen,0);assert.equal(x.calls.review,0);
 assert.equal(x.result.fromMemory,true);
 assert.equal(x.result.data.length,2);
});
test('partial final snapshots never masquerade as complete history',async()=>{
 const x=await check({rows:makeRows().slice(0,1)});
 assert.equal(x.calls.frozen,1);assert.equal(x.result.fromMemory,undefined);
});
test('not-yet-final and unfinished dates preserve existing archive fallback',async()=>{
 const a=await check({final:false});
 const b=await check({rows:[{id:'1',business_date:day,finished:false},makeRows()[1]]});
 assert.equal(a.calls.frozen,1);assert.equal(b.calls.frozen,1);
});
test('Pro never replaces protected historical prediction payload with guest-only cache',async()=>{
 const x=await check({pro:true});
 assert.equal(x.calls.frozen,1);assert.equal(x.result.fromMemory,undefined);
});
test('date mismatch invalidates cache reuse',async()=>{
 const rows=makeRows();rows[0].business_date='2026-10-27';
 const x=await check({rows});assert.equal(x.calls.frozen,1);
});
