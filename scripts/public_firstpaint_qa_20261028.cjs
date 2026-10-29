'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('homepage loads public-only rescue synchronously, ahead of deferred auth',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const start=html.indexOf('<script src="overview-public-rescue.js?v=20261029finalguard1"></script>');
 const sdk=html.indexOf('src="assets/vendor/supabase-js-2.117.3.js"');
 assert.ok(start>0&&sdk>start);
 assert.doesNotMatch(html,/<script defer src="overview-public-rescue/);
});

async function run({final=true}={}){
 const source=fs.readFileSync(path.join(root,'overview-public-rescue.js'),'utf8');
 const scheduled=[],listeners=[],requests=[];
 const els={
   jcLiveCards:{textContent:'正在确认登录状态…',dataset:{},innerHTML:''},
   jcYesterdayCards:{textContent:'正在加载中',dataset:{},innerHTML:''},
   jcDateLabel:{textContent:'读取日期',dataset:{}},
   jcYesterdayMeta:{textContent:'正在加载中',dataset:{}}
 };
 const ctx={
  window:{},document:{
    readyState:'loading',getElementById(k){return els[k]||null},
    addEventListener(event,callback){listeners.push(event)}
  },
  location:{search:'?date=2026-10-28',pathname:'/index.html'},
  URLSearchParams,Date,Intl,Set,
  setTimeout(callback,wait){scheduled.push({callback,wait})},
  console,fetch:async url=>{
   requests.push(url);
   const body=url==='data/overview/manifest.json'
     ?{dates:{'2026-10-27':'data/overview/2026-10-27.json'}}
     :{business_date:'2026-10-27',is_final:final,finished_count:1,match_count:1,
       rows:[{id:'public-fixture',match_num:'周二001',
         business_date:'2026-10-27',match_time:'19:00',
         league_short_name:'测试联赛',home_team_name:'主队',
         away_team_name:'客队',raw:{sectionsNo999:'2:1',sectionsNo1:'1:0'}}]};
   return {ok:true,async json(){return body}};
  }
 };
 vm.runInNewContext(source,ctx);
 assert.equal(listeners.length,0,'no DOMContentLoaded delay for markup already present');
 assert.equal(scheduled.length,1,'one public fallback timer');
 assert.equal(scheduled[0].wait,700);
 scheduled[0].callback();
 for(let i=0;i<15;i++)await Promise.resolve();
 return {els,requests};
}
test('public completed prior-day snapshot paints despite all auth JS delayed',async()=>{
 const {els,requests}=await run();
 assert.equal(requests.length,2);
 assert.match(els.jcYesterdayCards.innerHTML,/主队/);
 assert.match(els.jcYesterdayCards.innerHTML,/2-1/);
 assert.equal(els.jcLiveCards.innerHTML,'','protected current-day panel left untouched');
});
test('incomplete snapshot never becomes published completed review',async()=>{
 const {els}=await run({final:false});
 assert.equal(els.jcYesterdayCards.innerHTML,'');
});
