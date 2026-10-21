/* 球场档案：公开精选加选卡片，只读取经过发布确认的内容。 */
(function(){
'use strict';
var data=null;
var root=document.createElement('section');
root.id='qc-curated-extra';
root.style.margin='14px 0 18px';
var plans=document.getElementById('plans');
if(!plans)return;
plans.parentNode.insertBefore(root,plans.nextSibling);
/* Cards reuse original .plan, .plan-head, .legs, .chip and .plan-foot styles. */
root.classList.add('panels');
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function current(){return (document.getElementById('dateLabel')?.textContent||'').includes('10月21日')}
function project(){return document.querySelector('#tabs button.active')?.dataset.type||'direction'}
function status(g){return g.settlement_status==='settled'?(g.group_hit?'已命中':'未命中'):'待结算'}
function draw(){
 var admin=document.getElementById('qc-submitted-archive');
 var hasAdmin=Boolean(admin&&!admin.hidden&&admin.style.display!=='none');
 var view=data&&Array.isArray(data.groups)&&current()&&!hasAdmin;
 var item=view&&data.groups.find(function(x){return x.project===project()});
 root.hidden=!item;
 root.style.display=item?'grid':'none';
 if(!item)return;
 var label='分析师加选 · '+({direction:'胜平负',htft:'半全场',goals:'总进球',score:'比分'}[item.project]||item.format);
 var count=(item.legs||[]).length;
 var combo=(item.legs||[]).reduce(function(n,l){return n*(l.options||[]).length},1);
 var legs=(item.legs||[]).map(function(l){
 var choices=(l.options||[]).map(function(o){return '<span class="chip">'+esc(o.label)+' <i>×'+esc(o.odd)+'</i></span>'}).join('');
 return '<div class="leg"><div class="leg-top"><b>'+esc(l.match_num)+'　'+esc(l.home)+' vs '+esc(l.away)+'</b></div>'+
 '<div class="leg-meta">'+esc(({had:'普通胜平负',hhad:'官方让球',hafu:'半全场',ttg:'总进球',crs:'比分'})[l.market]||l.market)+'</div>'+
 '<div class="chips">'+choices+'</div></div>';
 }).join('');
 var state=status(item);
 root.innerHTML='<article class="plan variant-shadow">'+
 '<div class="plan-head"><span class="plan-id">'+esc(label)+'</span>'+
 '<span class="flag '+(state==='已命中'?'hit':state==='未命中'?'miss':'pending')+'">'+esc(state)+'</span></div>'+
 '<div class="legs">'+legs+'</div>'+
 '<div class="plan-foot"><div class="plan-return"><small>'+esc(item.format)+' · 完整选项</small>'+
 '<strong>'+count+'场 · '+combo+'种组合</strong></div><span class="leg-meta">仅供看球讨论</span></div></article>';
}
var q=false;
function schedule(){if(q)return;q=true;queueMicrotask(function(){q=false;draw()})}
new MutationObserver(schedule).observe(document.getElementById('dateLabel'),{childList:true,characterData:true,subtree:true});
new MutationObserver(schedule).observe(document.getElementById('tabs'),{attributes:true,attributeFilter:['class'],subtree:true});
async function init(){
 if(!window.qcSupabase)return;
 try{
  var reply=await window.qcSupabase.rpc('qc_curated_addons_public',{p_date:'2026-10-21'});
  if(reply.error)throw reply.error;
  if(!reply.data||!Array.isArray(reply.data.groups)||reply.data.groups.length!==4)return;
  data=reply.data;window.QC_CURATED_EXTRA=data;
  window.dispatchEvent(new Event('qc-curated-addons-ready'));
  draw();
 }catch(e){console.warn('精选方案暂时无法同步',String(e&&e.message||e))}
}
window.addEventListener('qc-curated-admin-ready',draw);
init();
setInterval(init,120000);
})();