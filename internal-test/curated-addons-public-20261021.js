/* 球场档案：公开精选加选卡片，只读取经过发布确认的内容。 */
(function(){
'use strict';
var data=null;
var root=document.createElement('section');
root.id='qc-curated-extra';
root.style.margin='14px 0 18px';
var plans=document.getElementById('plans');
if(!plans)return;
plans.parentNode.insertBefore(root,plans);
var h=document.createElement('style');
h.textContent='#qc-curated-extra[hidden]{display:none!important}.qc-addon-title{font-weight:850;font-size:17px;margin:10px 0}.qc-addon-card{background:white;border:1px solid #e1e8f3;border-left:3px solid #6b62b9;border-radius:14px;padding:15px 18px}.qc-addon-top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.qc-addon-top strong{color:#263c64;font-size:15px}.qc-addon-tag{background:#f1f0ff;color:#6457a9;border-radius:9px;font-size:11px;padding:6px 9px;font-weight:850}.qc-addon-leg{padding:11px 0;border-top:1px solid #ebeff5}.qc-addon-leg:first-child{margin-top:12px}.qc-addon-leg b{display:block;line-height:1.6;font-size:13px}.qc-addon-choice{display:inline-flex;background:#edf3ff;color:#2f579e;padding:5px 9px;border-radius:8px;margin:5px 7px 0 0;font-size:12px;font-weight:780}.qc-addon-note{font-size:11px;color:#7c8aa0;line-height:1.7;margin-top:10px}';
document.head.appendChild(h);
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function current(){return (document.getElementById('dateLabel')?.textContent||'').includes('10月21日')}
function project(){return document.querySelector('#tabs button.active')?.dataset.type||'direction'}
function status(g){return g.settlement_status==='settled'?(g.group_hit?'已命中':'未命中'):'待结算'}
function draw(){
 var view=data&&Array.isArray(data.groups)&&current()&&
   !(document.getElementById('qc-submitted-archive')?.hidden===false&&document.getElementById('qc-submitted-archive')?.style.display!=='none');
 var item=view&&data.groups.find(function(x){return x.project===project()});
 root.hidden=!item;if(!item)return;
 var names={direction:'胜平负 · 2串1',htft:'半全场 · 2串1',goals:'总进球 · 2串1',score:'比分 · 3串1'};
 var legs=(item.legs||[]).map(function(l){
 var choices=(l.options||[]).map(function(o){return '<span class="qc-addon-choice">'+esc(o.label)+' <i>&nbsp;×'+esc(o.odd)+'</i></span>'}).join('');
 return '<div class="qc-addon-leg"><b>'+esc(l.match_num)+'｜'+esc(l.home)+' vs '+esc(l.away)+'</b><div>'+choices+'</div></div>';
 }).join('');
 var combos=(item.legs||[]).reduce(function(acc,l){return acc*(l.options||[]).length},1);
 root.innerHTML='<div class="qc-addon-title">分析师加选方案</div><article class="qc-addon-card">'+
 '<div class="qc-addon-top"><strong>'+esc(names[item.project]||item.format)+'</strong><span class="qc-addon-tag">'+esc(status(item))+'</span></div>'+
 legs+'<div class="qc-addon-note">'+esc(item.format)+'｜共'+combos+'种组合。仅供赛事研究和看球讨论。</div></article>';
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
init();
})();