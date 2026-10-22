/* DB adapter only. It does not render or redesign the original 10/19 curated page. */
(function(){
'use strict';
var db=window.QC_CURATED_LAB_DATA;
if(!db){window.QC_CURATED_DB_READY=Promise.resolve();return}
function code(market,label){
 var map={胜:'h',平:'d',负:'a',让胜:'h',让平:'d',让负:'a'};
 if(market==='had'||market==='hhad')return map[label]||'';
 if(market==='hafu')return String(label).replace(/[\/／]/g,'').split('').map(function(c){return map[c]||''}).join('');
 if(market==='ttg')return 's'+String(label).replace('球','').replace('+','');
 if(market==='crs'){var m=String(label).match(/^(\d+)-(\d+)$/);return m?'s'+m[1].padStart(2,'0')+'s'+m[2].padStart(2,'0'):''}
 return '';
}
function entryFromGroup(g,addOn){
 var results=addOn?(g.leg_results||[]):[];
 return {type:g.project,note:addOn?'赛事分析师加选':'主模型正式提交',legs:(g.legs||[]).map(function(leg){
  var market=addOn?leg.market:leg.market_kind;
  var opts=addOn?(leg.options||[]):(leg.options||[]);
  var labels=addOn?opts.map(function(o){return o.label}):(leg.selections||[]);
  var result=results.find(function(x){return x.match_num===leg.match_num})||{};
  var mk={o:{},captured:leg.odds_captured_at||null};
  if(market==='hhad')mk.line=leg.line==null?leg.official_handicap:leg.line;
  var picks=labels.map(function(label,i){
   var src=opts.find(function(o){return o.label===label})||opts[i]||{},key=code(market,label),odd=Number(src.odd);
   if(Number.isFinite(odd)&&odd>1&&key)mk.o[key]=odd;
   return {key:key,name:label};
  });
  var row={d:g.business_date||'',num:leg.match_num,h:leg.home,a:leg.away,league:'',
   ft:addOn?result.ft:leg.ft,ht:addOn?result.ht:leg.ht,mk:{}};
  row.mk[market]=mk;
  return {row:row,market:market,picks:picks};
 })};
}
async function loadDay(day){
 var out=await Promise.all([
  window.qcSupabase.rpc('qc_selection_published_public',{p_business_date:day}),
  window.qcSupabase.rpc('qc_curated_addons_public',{p_date:day})
 ]);
 if(out[0].error)throw out[0].error;if(out[1].error)throw out[1].error;
 var main=out[0].data||{groups:[]},addon=out[1].data||{groups:[]};
 var baseline=(main.groups||[]).filter(function(g){return g.track==='baseline'}).map(function(g){g.business_date=day;return entryFromGroup(g,false)});
 var ai=(main.groups||[]).filter(function(g){return g.track==='ai_analyst'}).map(function(g){g.business_date=day;return entryFromGroup(g,false)});
 var analyst=(addon.groups||[]).map(function(g){g.business_date=day;return entryFromGroup(g,true)});
 if(!baseline.length&&!ai.length&&!analyst.length)return;
 db.selectedPlans=db.selectedPlans||{};
 db.selectedPlans[day]={
  originalLabel:'基准版',entries:baseline,
  aiSelector:{label:'AI精选版',entries:ai},
  analystSelector:{label:'赛事分析师加选',entries:analyst}
 };
}
window.QC_CURATED_DB_READY=(async function(){
 if(!window.qcSupabase)return;
 var nowParts={};
 new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(function(x){nowParts[x.type]=x.value});
 var end=new Date(nowParts.year+'-'+nowParts.month+'-'+nowParts.day+'T12:00:00Z');
 var days=[];
 for(var i=0;i<7;i++){var d=new Date(end.getTime()-i*86400000).toISOString().slice(0,10);if(d>='2026-10-21')days.push(d)}
 await Promise.all(days.map(loadDay));
})().catch(function(e){console.warn('精选生产数据适配失败',String(e&&e.message||e))});
})();