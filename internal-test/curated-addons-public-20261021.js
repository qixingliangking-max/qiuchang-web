/* 球场档案：公开精选加选卡片，只读取经过发布确认的内容。 */
(function(){
'use strict';
var data=null;
var requestSeq=0;
var historyDate='2026-10-21';
var addOnsByDay=Object.create(null);
var historyRequest=null;
var mainByDay=Object.create(null),mainRequests=Object.create(null),lastMainFetch=Object.create(null);
window.QC_CURATED_MAIN_PUBLISHED_BY_DAY=mainByDay;
async function loadPublishedMain(day){
 if(!day||day<'2026-10-21'||!window.qcSupabase)return;
 if(mainByDay[day]&&(mainByDay[day].batch_status==='published'||Date.now()-(lastMainFetch[day]||0)<90000))return mainByDay[day];
 if(mainRequests[day])return mainRequests[day];
 mainRequests[day]=(async function(){
  var r=await window.qcSupabase.rpc('qc_selection_published_public',{p_business_date:day});
  if(r.error)throw r.error;
  mainByDay[day]=r.data&&Array.isArray(r.data.groups)?r.data:{date:day,groups:[],batch_status:'missing'};
  lastMainFetch[day]=Date.now();
  draw();return mainByDay[day];
 })().catch(function(e){console.warn('主模型正式方案读取失败',day,String(e?.message||e))})
 .finally(function(){delete mainRequests[day]});
 return mainRequests[day];
}

function remember(day,pack){
 if(!pack||!Array.isArray(pack.groups))return;
 pack.date=pack.date||day;
 addOnsByDay[day]=pack;
 window.QC_CURATED_EXTRA_BY_DAY=addOnsByDay;
}
function historicalGroup(){
 return (addOnsByDay[historyDate]?.groups||[]).find(function(g){return g.project===project()})||null;
}
function historyMarkup(g){
 var label='分析师加选 · '+({direction:'胜平负',htft:'半全场',goals:'总进球',score:'比分'}[g.project]||g.format);
 var teams=(g.legs||[]).map(function(l){return esc(l.match_num+' '+l.home)}).join(' / ');
 var choices=(g.legs||[]).map(function(l){return (l.options||[]).map(function(o){return o.label}).join(' / ')}).join(' · ');
 var outcome=status(g);
 return '<span class="hist-day">10/21</span>'+
   '<span class="hist-leg"><b>'+teams+'</b><small>'+esc(label)+' · '+esc(choices)+'</small></span>'+
   '<span class="hist-amount">—</span>'+
   '<span class="hist-status '+(outcome==='已命中'?'hit':outcome==='待结算'?'pending':'')+'">'+esc(outcome)+'</span>';
}
function drawHistoric(){
 var host=document.getElementById('history');
 if(!host)return;
 var g=historicalGroup(),old=host.querySelector('[data-qc-addon-history="2026-10-21"]');
 if(!g){if(old)old.remove();return;}
 var state=g.project+'|'+g.settlement_status+'|'+g.group_hit;
 // Keep this independent of the admin archive: only one public history row.
 if(old&&old.dataset.qcAddonState===state)return;
 if(old)old.remove();
 var el=document.createElement('button');el.type='button';el.className='hist-row';
 el.dataset.qcAddonHistory=historyDate;el.dataset.qcAddonState=state;
 el.dataset.qcDetailKind='addon';el.dataset.qcDetailCode=g.project;el.dataset.qcDetailDay=historyDate;
 el.innerHTML=historyMarkup(g);
 host.insertBefore(el,host.firstChild);
}
var historicQueued=false;
function scheduleHistoric(){
 if(historicQueued)return;
 historicQueued=true;queueMicrotask(function(){historicQueued=false;drawHistoric()});
}
async function loadHistoric(){
 if(addOnsByDay[historyDate]?.groups?.length)return addOnsByDay[historyDate];
 if(historyRequest)return historyRequest;
 if(!window.qcSupabase)return;
 historyRequest=(async function(){
  var response=await window.qcSupabase.rpc('qc_curated_addons_public',{p_date:historyDate});
  if(response.error)throw response.error;
  var pack=response.data;
  if(!pack||!Array.isArray(pack.groups))throw new Error('历史加选数据格式异常');
  remember(historyDate,pack);
  if(pack.groups.length && (!window.QC_CURATED_EXTRA?.groups?.length)){
   window.QC_CURATED_EXTRA=pack;
  }
  scheduleHistoric();
  window.dispatchEvent(new Event('qc-curated-addons-ready'));
  return pack;
 })().catch(function(err){console.warn('10月21日加选历史读取异常',String(err?.message||err));return null})
 .finally(function(){historyRequest=null});
 return historyRequest;
}
var root=document.createElement('section');
root.id='qc-curated-extra';
root.style.margin='0 0 18px';
var plans=document.getElementById('plans');
if(!plans)return;
/* 插入原有方案之前，复用原页面卡片样式；不替换任何既有方案。 */
plans.parentNode.insertBefore(root,plans);
root.classList.add('panels');
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function selectedDate(){
 var el=document.getElementById('dateLabel');
 var ds=el&&el.dataset?el.dataset.businessDate:'';
 if(/^\d{4}-\d{2}-\d{2}$/.test(ds))return ds;
 var m=String(el&&el.textContent||'').match(/(\d{1,2})月(\d{1,2})日/);
 if(!m)return '';
 return (new Date()).getFullYear()+'-'+String(m[1]).padStart(2,'0')+'-'+String(m[2]).padStart(2,'0');
}
function project(){return document.querySelector('#tabs button.active')?.dataset.type||'direction'}
function status(g){return g.settlement_status==='settled'?(g.group_hit?'已命中':'未命中'):'待结算'}
function placeholder(label,reason,kind){
 return '<article class="plan '+(kind==='analyst'?'variant-shadow':'')+'" data-qc-placeholder="'+esc(kind)+'">'+
 '<div class="plan-head"><span class="plan-id">'+esc(label)+'</span><span class="flag pending">待同步</span></div>'+
 '<div class="legs"><div class="leg">'+esc(reason)+'</div></div></article>';
}
function makeCard(label,g,day,isAddon){
 if(!g)return placeholder(label,isAddon?'赛事分析师方案尚未发布。':'主模型该方案尚未正式提交。',isAddon?'analyst':'main');
 var statusText=status(g),count=(g.legs||[]).length;
 var combos=(g.legs||[]).reduce(function(n,l){return n*(isAddon?(l.options||[]).length:(l.selections||[]).length)},1);
 var legs=(g.legs||[]).map(function(l){
  var opts=isAddon?(l.options||[]).map(function(x){return x.label}):l.selections||[];
  return '<div class="leg"><div class="leg-top"><b>'+esc(l.match_num)+'　'+esc(l.home)+' vs '+esc(l.away)+'</b></div>'+
   '<div class="leg-meta">'+esc(({had:'普通胜平负',hhad:'官方让球',hafu:'半全场',ttg:'总进球',crs:'比分'})[isAddon?l.market:l.market_kind]||'')+'</div>'+
   '<div class="chips">'+opts.map(function(x){return '<span class="chip">'+esc(x)+'</span>'}).join('')+'</div></div>';
 }).join('');
 return '<article class="plan '+(!isAddon&&g.track==='baseline'?'variant-original':'variant-shadow')+
   '" data-qc-detail-kind="'+(isAddon?'addon':'admin')+'" data-qc-detail-code="'+esc(isAddon?g.project:g.group_code)+
   '" data-qc-detail-day="'+esc(day)+'" style="cursor:pointer">'+
   '<div class="plan-head"><span class="plan-id">'+esc(label)+'</span><span class="flag '+
   (statusText==='已命中'?'hit':statusText==='未命中'?'miss':'pending')+'">'+esc(statusText)+'</span></div>'+
   '<div class="legs">'+legs+'</div><div class="plan-foot"><div class="plan-return"><small>'+
   esc(isAddon?g.format:'主模型已发布方案')+' · 完整选项</small><strong>'+count+'场 · '+combos+
   '种组合</strong></div><button type="button" class="inspect">方案详情 →</button></div></article>';
}
function draw(){
 scheduleHistoric();
 var admin=document.getElementById('qc-submitted-archive');
 var hasAdmin=Boolean(admin&&!admin.hidden&&admin.style.display!=='none');
 var day=selectedDate();
 if(day<'2026-10-21'){plans.hidden=false;plans.style.display='';root.hidden=true;root.style.display='none';root.innerHTML='';return;}
 if(hasAdmin){root.hidden=true;root.style.display='none';root.innerHTML='';return;}
 // Existing auto-selected cards are NOT the main-model submitted baseline/AI.
 plans.hidden=true;plans.style.display='none';
 root.hidden=false;root.style.display='grid';
 var main=mainByDay[day],projectKey=project(),groups=main?.batch_status==='published'?(main.groups||[]).filter(function(g){return g.project===projectKey}):[];
 var base=groups.find(function(g){return g.track==='baseline'});
 var ai=groups.find(function(g){return g.track==='ai_analyst'});
 var addon=data?.date===day?(data.groups||[]).find(function(g){return g.project===projectKey}):null;
 root.innerHTML=makeCard('主模型 · 基准版',base,day,false)+makeCard('主模型 · AI精选版',ai,day,false)+
  makeCard('赛事分析师加选',addon,day,true);
 var meta=document.getElementById('dailyMeta'),band=document.getElementById('infoBand');
 if(meta)meta.textContent='共3组 · 基准版 / AI精选版 / 赛事分析师加选';
 if(band)band.textContent=groups.length===2?'每个玩法固定三组：主模型基准版、AI精选版和赛事分析师加选。':
 '主模型两组尚未正式提交或发布，不能用每日自动精选代替；已发布的分析师加选单列第三组。';
}
async function loadDate(force){
 var date=selectedDate();
 if(!date||!window.qcSupabase)return;
 if(!force&&data&&data.date===date){draw();return;}
 var seq=++requestSeq;
 root.hidden=true;root.style.display='none';
 try{
  var reply=await window.qcSupabase.rpc('qc_curated_addons_public',{p_date:date});
  if(seq!==requestSeq||date!==selectedDate())return;
  if(reply.error)throw reply.error;
  if(!reply.data||!Array.isArray(reply.data.groups))throw new Error('精选加选数据格式异常');
  data=reply.data;
  data.date=data.date||date;
  loadPublishedMain(date);
  remember(date,data);
  if(data.groups.length){
   window.QC_CURATED_EXTRA=data;
   window.dispatchEvent(new Event('qc-curated-addons-ready'));
  }else{
   // An empty current day never clears already-published historical extras.
   await loadHistoric();
   if(seq!==requestSeq||date!==selectedDate())return;
  }
  draw();
 }catch(e){
  if(seq===requestSeq&&date===selectedDate()){
   data={date:date,groups:[]};
   draw();
  }
  console.warn('精选方案暂时无法同步',String(e&&e.message||e));
 }
}
var queued=false;
function schedule(){
 if(queued)return;
 queued=true;
 queueMicrotask(function(){queued=false;loadDate(true)});
}
var dateLabel=document.getElementById('dateLabel');
if(dateLabel)new MutationObserver(function(){schedule();scheduleHistoric()}).observe(dateLabel,{childList:true,characterData:true,subtree:true});
var tabs=document.getElementById('tabs');
if(tabs)new MutationObserver(function(){draw();scheduleHistoric()}).observe(tabs,{attributes:true,attributeFilter:['class'],subtree:true});
window.addEventListener('qc-curated-admin-ready',function(){draw();scheduleHistoric()});
var historyContainer=document.getElementById('history');
if(historyContainer)new MutationObserver(scheduleHistoric).observe(historyContainer,{childList:true});
loadHistoric();
loadDate(true);
setInterval(function(){loadDate(true)},120000);
})();