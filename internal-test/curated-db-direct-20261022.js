(function(){
'use strict';
var db=window.QC_CURATED_LAB_DATA;
if(!db){window.QC_CURATED_DB_READY=Promise.resolve();return}
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
   'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'application/json'
  },body:JSON.stringify(args||{})});
  if(!r.ok)throw Error(name+' HTTP '+r.status);
  return await r.json();
 }finally{clearTimeout(timer)}

}
var daySnapshot=Object.create(null);
async function loadDay(day){
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
   });
  }));
 }finally{refreshActive=false}
}
// Never block the original page on a network round trip. Render existing data immediately.
window.QC_CURATED_DB_READY=Promise.resolve();
setTimeout(refresh,0);
setInterval(refresh,120000);
})();