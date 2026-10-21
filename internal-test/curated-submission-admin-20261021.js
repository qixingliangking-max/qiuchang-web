/* 球场档案｜中央精选档案（仅网站管理员登录后显示候选）
   独立读取受控RPC，不访问其他工作室表格，不写入FINAL。
   原有10/19起冻结方案与历史回看仍由原页面管理。 */
(function(){
'use strict';
var targetDay='2026-10-21', archive=null;
var root=document.createElement('section');root.id='qc-submitted-archive';root.hidden=true;
root.setAttribute('aria-label','中央每日精选测试档案');
/* Use original .plan/.plan-head/.legs/.chip/.plan-foot styles unchanged. */
var plans=document.getElementById('plans'),history=document.getElementById('history');
plans?.parentNode?.insertBefore(root,plans);
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function dayIsCurrent(){return (document.getElementById('dateLabel')?.textContent||'').includes('10月21日')}
function project(){return document.querySelector('#tabs button.active')?.dataset.type||'direction'}

function readableMarket(kind){return ({had:'普通胜平负',hhad:'官方让球',hafu:'半全场',ttg:'总进球',crs:'比分'})[kind]||kind}
function hitStatus(row){return row.settlement_status==='settled'?(row.group_hit?'命中':'未中'):'待结算'}
function name(track){return track==='baseline'?'基准版':'AI精选版'}
function countCombos(legs,addon){
 return (legs||[]).reduce(function(n,l){return n*(addon?(l.options||[]).length:(l.selections||[]).length)},1);
}
function legMarkup(l,addon){
 var title='<div class="leg-top"><b>'+esc(l.match_num)+'　'+esc(l.home)+' vs '+esc(l.away)+'</b></div>';
 var market=addon?l.market:l.market_kind;
 var line=l.handicap;
 var meta='<div class="leg-meta">'+esc(readableMarket(market))+(line!==null&&line!==undefined?'（'+esc(line)+'）':'')+'</div>';
 var options=addon
  ?(l.options||[]).map(function(o){return '<span class="chip">'+esc(o.label)+' <i>×'+esc(o.odd)+'</i></span>'}).join('')
  :(l.selections||[]).map(function(o){return '<span class="chip">'+esc(o)+'</span>'}).join('');
 var result=(!addon&&l.ft&&l.ht)
   ?'<div class="leg-result">赛果 '+esc(l.ft)+' ｜ 半场 '+esc(l.ht)+'</div>':'';
 return '<div class="leg">'+title+meta+'<div class="chips">'+options+'</div>'+result+'</div>';
}
function consistentCard(label,legs,tag,variant,addon,format){
 var count=(legs||[]).length,combos=countCombos(legs,addon);
 var head='<div class="plan-head"><span class="plan-id">'+esc(label)+'</span><span class="flag '+(tag==='命中'?'hit':tag==='未中'?'miss':'pending')+'">'+esc(tag)+'</span></div>';
 var body='<div class="legs">'+(legs||[]).map(function(l){return legMarkup(l,addon)}).join('')+'</div>';
 var summary='<div class="plan-foot"><div class="plan-return"><small>'+esc(format||'双场方案')+' · 完整选项</small><strong>'+count+'场 · '+combos+'种组合</strong></div><span class="leg-meta">仅供看球讨论</span></div>';
 return '<article class="plan '+esc(variant)+'">'+head+body+summary+'</article>';
}
function card(row){
 return consistentCard(name(row.track),row.legs,hitStatus(row),row.track==='baseline'?'variant-original':'variant-shadow',false,'双场方案');
}
function addonCard(row){
 if(!row)return '';
 var title='分析师加选 · '+({direction:'胜平负',htft:'半全场',goals:'总进球',score:'比分'}[row.project]||row.format);
 return consistentCard(title,row.legs,hitStatus(row),'variant-shadow',true,row.format);
}
function draw(){
if(!archive)return;
var currently=dayIsCurrent();root.hidden=!currently;root.style.display=currently?'':'none';plans.hidden=currently;plans.style.display=currently?'none':'';
if(currently){
 var sub=archive.groups.filter(g=>g.project===project());
 var addon=(window.QC_CURATED_EXTRA&&window.QC_CURATED_EXTRA.groups||[]).find(function(g){return g.project===project()});
 root.innerHTML='<div class="panels">'+sub.map(card).join('')+addonCard(addon)+'</div>';
 var t=document.getElementById('dailyTitle'),meta=document.getElementById('dailyMeta');
 if(t)t.textContent='10月21日 · '+({direction:'方向',htft:'半全场',goals:'总进球',score:'比分'}[project()])+'精选测试';
 if(meta)meta.textContent=(sub.length+(addon?1:0))+'组方案';
 var band=document.getElementById('infoBand');if(band)band.textContent='精选方案仅用于赛事研究；未结束的比赛暂不显示结算结果。';
}
if(history){
 history.querySelectorAll('[data-qc-submitted-row]').forEach(e=>e.remove());
 // Keep original 10/19 and 10/20 history; do not mix today's legacy auto pairs with central submitted records.
 history.querySelectorAll('[data-open-date="2026-10-21"]').forEach(e=>e.remove());
 var related=archive.groups.filter(g=>g.project===project());
 var rows=related.map(function(g){
  var teams=(g.legs||[]).map(function(l){return esc(l.match_num+' '+l.home)}).join(' / ');
  var picks=(g.legs||[]).map(function(l){return (l.selections||[]).join(' / ')}).join(' · ');
  var amount='—';
  return '<div class="hist-row" data-qc-submitted-row="1">'+
   '<span class="hist-day">10/21</span>'+
   '<span class="hist-leg"><b>'+teams+'</b><small>'+esc(name(g.track))+' · '+esc(picks)+'</small></span>'+
   '<span class="hist-amount">'+amount+'</span>'+
   '<span class="hist-status">'+esc(hitStatus(g))+'</span></div>';
 }).join('');
 var extra=(window.QC_CURATED_EXTRA&&window.QC_CURATED_EXTRA.groups||[]).find(function(g){return g.project===project()});
 if(extra){
  var teams=(extra.legs||[]).map(function(l){return esc(l.match_num+' '+l.home)}).join(' / ');
  rows+='<div class="hist-row" data-qc-submitted-row="1">'+
   '<span class="hist-day">10/21</span>'+
   '<span class="hist-leg"><b>'+teams+'</b><small>分析师加选 · '+esc(extra.format)+'</small></span>'+
   '<span class="hist-amount">—</span>'+
   '<span class="hist-status">'+esc(extra.settlement_status==='settled'?(extra.group_hit?'命中':'未中'):'待结算')+'</span></div>';
 }
 if(rows)history.insertAdjacentHTML('afterbegin',rows);
}
}
var queued=false;
function queueDraw(){if(queued)return;queued=true;queueMicrotask(function(){queued=false;draw();});}
new MutationObserver(queueDraw).observe(document.getElementById('dateLabel'),{subtree:true,childList:true,characterData:true});
new MutationObserver(queueDraw).observe(document.getElementById('tabs'),{subtree:true,attributes:true,attributeFilter:['class']});
// History redraw is owned by the legacy page; avoid observing our own insertions.
document.getElementById('budget')?.addEventListener('input',queueDraw);
document.getElementById('modeTabs')?.addEventListener('click',queueDraw);
async function start(){
if(!window.qcSupabase){return;}
try{
 const a=await window.qcSupabase.auth.getSession();
 if(!a.data?.session){return;}
 const r=await window.qcSupabase.rpc('qc_curated_admin_preview',{p_business_date:targetDay});
 if(r.error){if(!/ADMIN_REQUIRED/i.test(r.error.message||''))console.warn('精选测试后台读取失败',r.error.message);return;}
 if(!r.data||!Array.isArray(r.data.groups)||r.data.groups.length!==8)return;
 archive=r.data;queueDraw();window.dispatchEvent(new Event('qc-curated-admin-ready'));
 window.qcSupabase.auth.onAuthStateChange(function(ev,session){
  if(!session){archive=null;root.hidden=true;root.style.display='none';plans.hidden=false;plans.style.display='';window.dispatchEvent(new Event('qc-curated-admin-ready'));}
 });
}catch(e){console.warn('精选测试档案读取异常',String(e))}
}
window.addEventListener('qc-curated-addons-ready',queueDraw);
start();
})();
