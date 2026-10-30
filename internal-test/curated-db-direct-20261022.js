(function(){
'use strict';
var db=window.QC_CURATED_LAB_DATA||(window.QC_CURATED_LAB_DATA={matches:[],selectedPlans:{}});
Object.keys(db.selectedPlans||{}).forEach(function(day){if(day>='2026-10-22')delete db.selectedPlans[day]});
function keyFor(market,label){
 var map={'胜':'h','平':'d','负':'a','让胜':'h','让平':'d','让负':'a'};
 if(market==='had'||market==='hhad')return map[label]||'';
 if(market==='hafu'){
  var x=String(label).replace(/[\/／]/g,'');
  return x.split('').map(function(c){return map[c]||''}).join('');
 }
 if(market==='ttg'){
  var n=String(label).replace(/球/g,'').replace('+','');
  return /^\d$/.test(n)?'s'+n:'';
 }
 if(market==='crs'){
  var m=String(label).match(/^(\d{1,2})-(\d{1,2})$/);
  return m?'s'+m[1].padStart(2,'0')+'s'+m[2].padStart(2,'0'):'';
 }
 return '';
}
function normScore(v){return v==null?null:String(v).replace(':','-')}
function buildLeg(day,leg,isAddon,result){
 var market=isAddon?leg.market:leg.market_kind;
 var options=isAddon?(leg.options||[]):(leg.options||[]);
 var labels=isAddon?options.map(function(x){return x.label}):(leg.selections||[]);
 var oddsByLabel={};
 options.forEach(function(x){if(x&&x.label!=null)oddsByLabel[String(x.label)]=Number(x.odd)});
 var out={};
 labels.forEach(function(label){
  var key=keyFor(market,label),odd=oddsByLabel[String(label)];
  if(key&&Number.isFinite(odd)&&odd>1)out[key]=odd;
 });
 var mk={o:out,captured:leg.odds_captured_at||null};
 if(market==='hhad')mk.line=Number(leg.official_handicap!=null?leg.official_handicap:leg.line);
 var row={
  d:day,num:leg.match_num,h:leg.home,a:leg.away,league:leg.league||'',
  ft:normScore(isAddon?(result&&result.ft):leg.ft),
  ht:normScore(isAddon?(result&&result.ht):leg.ht),
  mk:{}
 };
 row.mk[market]=mk;
 return {row:row,market:market,picks:labels.map(function(label){return {key:keyFor(market,label),name:String(label)}})};
}
function buildMainEntry(day,g){
 return {type:g.project,gate:'中央主模型提交',legs:(g.legs||[]).map(function(leg){return buildLeg(day,leg,false,null)})};
}
function buildAddonEntry(day,g){
 var results=g.leg_results||[];
 return {type:g.project,gate:'赛事分析师加选',legs:(g.legs||[]).map(function(leg){
   var result=results.find(function(x){return x.match_num===leg.match_num})||null;
   return buildLeg(day,leg,true,result);
 })};
}
async function rpc(name,args){
 var url=(window.QC_SUPABASE_URL||'').replace(/\/$/,'')+'/rest/v1/rpc/'+name;
 var key=window.QC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw Error('Supabase public config missing');
 var controller=new AbortController(),timer=setTimeout(function(){controller.abort()},7000);
 try{
  var r=await fetch(url,{method:'POST',cache:'no-store',signal:controller.signal,headers:{
   'apikey':key,'Content-Type':'application/json','Accept':'application/json'
  },body:JSON.stringify(args||{})});
  if(!r.ok)throw Error(name+' HTTP '+r.status);
  return await r.json();
 }finally{clearTimeout(timer)}

}

function buildV2Entry(day,p){
 var results=Array.isArray(p.leg_results)?p.leg_results:[];
 return {id:p.id,type:p.market_group,format:p.version,gate:'',legs:(p.legs||[]).map(function(leg){
   var result=results.find(function(r){return r.match_num===leg.match_num})||null;
   return buildLeg(day,{
      market:leg.market,match_num:leg.match_num,home:leg.home,away:leg.away,
      league:leg.league,official_handicap:leg.line,
      options:(leg.options||[]).map(function(o){return {label:o.label,odd:o.odd}}),
      odds_captured_at:leg.odds_captured_at
    },true,result);
 })};
}
async function loadReplayDay(day){
 var raw=await rpc('qc_v2_replay_public',{p_business_date:day});
 if(!raw||!raw.replay)throw Error('Missing replay marker for '+day);
 var byId={};
 (Array.isArray(raw.analysts)?raw.analysts:[]).forEach(function(a){byId[a.id]=a});
 var g=byId.guheng||{plans:[]},s=byId.shence||{plans:[]},l=byId.luye||{plans:[]};
 function replayEntries(a){
  return (a.plans||[]).map(function(p){
   var record=buildV2Entry(day,p);
   record.replay=true;
   record.note='10月22日赛前数据回放｜事后建立的回测，不计入真实连红';
   return record;
  });
 }
 db.selectedPlans=db.selectedPlans||{};
 db.selectedPlans[day]={
  rule:'QCDA_ASOF_REPLAY_EXCLUDED_FROM_STREAK',
  isReplay:true,
  entries:replayEntries(g),
  aiSelector:{entries:replayEntries(s)},
  analystSelector:{entries:replayEntries(l)},
  streaks:{1:0,2:0,3:0}
 };
 return true;
}
async function loadV23PreviewDay(day){
 var raw=await rpc('qc_v2_public',{p_business_date:day});
 if(!raw||!Array.isArray(raw.analysts)||raw.analysts.length!==3)
  throw Error('V2.3 independent review is unavailable');
 var byId={};
 raw.analysts.forEach(function(a){byId[a.id]=a});
 if(!byId.guheng||!byId.shence||!byId.luye)throw Error('V2.3 analyst identity missing');
 var entries=function(id){
  var plans=(byId[id].plans||[]).filter(function(p){
    return p.settlement_status!=='void' && Array.isArray(p.legs) && p.legs.length>0
      && p.legs.every(function(leg){return Array.isArray(leg.options)&&leg.options.length>0
        && leg.options.every(function(o){return o.source==='LOCKED_FINAL'})});
  });
  if(plans.length!==1)throw Error('V2.3 active plan count mismatch: '+id);
  return plans.map(function(p){return buildV2Entry(day,p)});
 };
 var pack={
  rule:'QCDA_V23_CURATED_FORMAL',preview:false,
  entries:entries('guheng'),
  aiSelector:{entries:entries('shence')},
  analystSelector:{entries:entries('luye')},
  streaks:{1:0,2:0,3:0}
 };
 db.selectedPlans=db.selectedPlans||{};
 if(JSON.stringify(db.selectedPlans[day])===JSON.stringify(pack))return false;
 db.selectedPlans[day]=pack;
 return true;
}
async function loadIndependentDay(day){
 if(day==='2026-10-30')return loadV23PreviewDay(day);
 var raw=await rpc('qc_v2_public',{p_business_date:day});
 var sources=Array.isArray(raw&&raw.analysts)?raw.analysts:[];
 var byId={};
 sources.forEach(function(a){byId[a.id]=a});
 var a1=byId.guheng||{plans:[],streak:0},a2=byId.shence||{plans:[],streak:0},a3=byId.luye||{plans:[],streak:0};
 db.selectedPlans=db.selectedPlans||{};
 var pack={
  rule:'QCDA_INDEPENDENT_3_ANALYSTS_V2',
  entries:(a1.plans||[]).map(function(p){return buildV2Entry(day,p)}),
  aiSelector:{entries:(a2.plans||[]).map(function(p){return buildV2Entry(day,p)})},
  analystSelector:{entries:(a3.plans||[]).map(function(p){return buildV2Entry(day,p)})},
  streaks:{1:Number(a1.streak)||0,2:Number(a2.streak)||0,3:Number(a3.streak)||0}
 };
 if(JSON.stringify(db.selectedPlans[day])===JSON.stringify(pack))return false;
 db.selectedPlans[day]=pack;
 return true;
}

var daySnapshot=Object.create(null);
async function loadDay(day){
 if(day==='2026-10-22')return loadReplayDay(day);
 if(day>='2026-10-23')return loadIndependentDay(day);
 var pair=await Promise.allSettled([
  rpc('qc_selection_display_public',{p_business_date:day}),
  rpc('qc_curated_addons_public',{p_date:day})
 ]);
 if(pair.every(function(r){return r.status==='rejected'}))throw Error('两条读取通道均不可用');
 var cached=daySnapshot[day]||{};
 var main=pair[0].status==='fulfilled'?(pair[0].value||{groups:[]}):(cached.main||{groups:[]});
 var addons=pair[1].status==='fulfilled'?(pair[1].value||{groups:[]}):(cached.addons||{groups:[]});
 daySnapshot[day]={main:main,addons:addons};
 var baseline=(main.groups||[]).filter(function(g){return g.track==='baseline'}).map(function(g){return buildMainEntry(day,g)});
 var ai=(main.groups||[]).filter(function(g){return g.track==='ai_analyst'}).map(function(g){return buildMainEntry(day,g)});
 var analyst=(addons.groups||[]).map(function(g){return buildAddonEntry(day,g)});
 if(!baseline.length&&!ai.length&&!analyst.length)return false;
 db.selectedPlans=db.selectedPlans||{};
 db.selectedPlans[day]={
  rule:'QCDA_DB_DIRECT_VIEW_V1',
  originalLabel:'基准版',
  entries:baseline,
  aiSelector:{label:'AI精选版',entries:ai},
  analystSelector:{label:'赛事分析师加选',entries:analyst},
  sourceMeta:{mainStatus:main.batch_status||'missing',mainVersion:main.final_version||null}
 };
 return true;
}
function recentDays(){
 var parts={};
 new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'})
  .formatToParts(new Date()).forEach(function(x){parts[x.type]=x.value});
 var base=new Date(parts.year+'-'+parts.month+'-'+parts.day+'T12:00:00Z'),days=[];
 for(var i=0;i<7;i++){
  var d=new Date(base.getTime()-i*86400000).toISOString().slice(0,10);
  if(d>='2026-10-21')days.push(d);
 }
 return days;
}
var refreshActive=false;
async function refresh(){
 if(refreshActive)return;
 refreshActive=true;
 try{
  var days=recentDays();
  await Promise.all(days.map(function(day){
   return loadDay(day).then(function(changed){
    if(changed)window.dispatchEvent(new Event('qc-curated-db-update'));
   }).catch(function(e){
    console.warn('精选数据读取失败，可在下次刷新重试',day,String(e));
    if(day>='2026-10-22')window.dispatchEvent(new CustomEvent('qc-curated-db-error',{detail:{date:day,message:String(e)}}));
   });
  }));
 }finally{refreshActive=false}
}
// Load the current live business day BEFORE the first visible render.
// The old static archive remains available for historical browsing only.
function businessDay(){
 var p={};
 new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'})
  .formatToParts(new Date()).forEach(function(x){p[x.type]=x.value});
 var stamp=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day));
 if(Number(p.hour)<12)stamp-=86400000;
 return new Date(stamp).toISOString().slice(0,10);
}
var initialDay=businessDay();
window.QC_CURATED_DB_READY=loadDay(initialDay).then(function(changed){
 if(changed)window.dispatchEvent(new Event('qc-curated-db-update'));
 return true;
}).catch(function(error){
 console.warn('当前精选数据首屏读取失败',initialDay,String(error));
 window.QC_CURATED_INITIAL_ERROR=String(error);
 window.dispatchEvent(new CustomEvent('qc-curated-db-error',{detail:{date:initialDay,message:String(error)}}));
 return false;
});
window.QC_CURATED_DB_READY.then(function(){setTimeout(refresh,0)});
setInterval(refresh,120000);
})();