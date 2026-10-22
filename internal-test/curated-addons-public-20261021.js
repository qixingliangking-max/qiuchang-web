/* 球场档案：公开精选加选卡片，只读取经过发布确认的内容。 */
(function(){
'use strict';
var data=null;
var requestSeq=0;
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
function draw(){
 var admin=document.getElementById('qc-submitted-archive');
 var hasAdmin=Boolean(admin&&!admin.hidden&&admin.style.display!=='none');
 var date=selectedDate();
 var view=data&&data.date===date&&Array.isArray(data.groups)&&!hasAdmin;
 var item=view&&data.groups.find(function(x){return x.project===project()});
 root.hidden=!item;
 root.style.display=item?'grid':'none';
 if(!item){root.innerHTML='';return;}
 var label='分析师加选 · '+({direction:'胜平负',htft:'半全场',goals:'总进球',score:'比分'}[item.project]||item.format);
 var count=(item.legs||[]).length;
 var combo=(item.legs||[]).reduce(function(n,l){return n*(l.options||[]).length},1);
 var legs=(item.legs||[]).map(function(l){
  var choices=(l.options||[]).map(function(o){return '<span class="chip">'+esc(o.label)+'</span>'}).join('');
  return '<div class="leg"><div class="leg-top"><b>'+esc(l.match_num)+'　'+esc(l.home)+' vs '+esc(l.away)+'</b></div>'+
   '<div class="leg-meta">'+esc(({had:'普通胜平负',hhad:'官方让球',hafu:'半全场',ttg:'总进球',crs:'比分'})[l.market]||l.market)+'</div>'+
   '<div class="chips">'+choices+'</div></div>';
 }).join('');
 var state=status(item);
 root.innerHTML='<article class="plan variant-shadow" data-qc-detail-kind="addon" data-qc-detail-code="'+esc(item.project)+'" style="cursor:pointer">'+
  '<div class="plan-head"><span class="plan-id">'+esc(label)+'</span>'+
  '<span class="flag '+(state==='已命中'?'hit':state==='未命中'?'miss':'pending')+'">'+esc(state)+'</span></div>'+
  '<div class="legs">'+legs+'</div>'+
  '<div class="plan-foot"><div class="plan-return"><small>'+esc(item.format)+' · 完整选项</small>'+
  '<strong>'+count+'场 · '+combo+'种组合</strong></div><button type="button" class="inspect">方案详情 →</button></div></article>';
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
  if(data.groups.length){
   window.QC_CURATED_EXTRA=data;
   window.dispatchEvent(new Event('qc-curated-addons-ready'));
  }else if(!Array.isArray(window.QC_CURATED_EXTRA?.groups)||!window.QC_CURATED_EXTRA.groups.length){
   /* Keep the latest already-published historical set available for history/admin details;
      an empty current day must not erase it or make the page look as if records vanished. */
   var fallback=await window.qcSupabase.rpc('qc_curated_addons_public',{p_date:'2026-10-21'});
   if(seq!==requestSeq||date!==selectedDate())return;
   if(!fallback.error&&fallback.data&&Array.isArray(fallback.data.groups)&&fallback.data.groups.length){
    window.QC_CURATED_EXTRA=fallback.data;
    window.dispatchEvent(new Event('qc-curated-addons-ready'));
   }
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
if(dateLabel)new MutationObserver(schedule).observe(dateLabel,{childList:true,characterData:true,subtree:true});
var tabs=document.getElementById('tabs');
if(tabs)new MutationObserver(draw).observe(tabs,{attributes:true,attributeFilter:['class'],subtree:true});
window.addEventListener('qc-curated-admin-ready',draw);
loadDate(true);
setInterval(function(){loadDate(true)},120000);
})();