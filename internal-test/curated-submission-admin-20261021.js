/* 球场档案｜中央精选档案（仅网站管理员登录后显示候选）
   独立读取受控RPC，不访问其他工作室表格，不写入FINAL。
   原有10/19起冻结方案与历史回看仍由原页面管理。 */
(function(){
'use strict';
var targetDay='2026-10-21', archive=null;
var root=document.createElement('section');root.id='qc-submitted-archive';root.hidden=true;
root.setAttribute('aria-label','中央每日精选测试档案');
var style=document.createElement('style');
style.textContent=[
'#qc-submitted-archive{margin-top:14px}',
'.qca-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
'.qca-card{min-width:0;padding:19px 17px;background:#fff;border:1px solid #dfe6f2;border-radius:16px;box-shadow:0 7px 24px rgba(32,53,96,.04)}',
'.qca-head{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap;margin-bottom:13px}',
'.qca-head strong{font-size:16px;color:#253c68}',
'.qca-tag{padding:5px 9px;border-radius:7px;font-size:11px;background:#edf3ff;color:#355ba5;font-weight:850}',
'.qca-ai{border-top:3px solid #7757b5}.qca-ai .qca-head strong{color:#7154ab}',
'.qca-leg{padding:13px 0;border-top:1px solid #ecf0f5}',
'.qca-leg b{display:block;font-size:13px;line-height:1.6}',
'.qca-picks{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}',
'.qca-pick{font-size:12px;padding:5px 10px;border-radius:8px;background:#f1f5fe;color:#2f5cb3;font-weight:800}',
'.qca-diff{font-size:11px;color:#a66d28;margin-top:7px}',
'.qca-foot{color:#78869b;font-size:11px;line-height:1.8;margin-top:11px}',
'.qca-description{margin:0 0 13px;color:#61718c;font-size:12px;line-height:1.7}',
'.qca-title{font-size:19px;font-weight:900;margin:14px 0 5px}',
'.qca-alert{background:#fff9eb;color:#916522;border:1px solid #f0dbaa;padding:10px 13px;border-radius:10px;margin-bottom:13px;font-size:12px;line-height:1.7}',
'.qca-hist{display:grid;grid-template-columns:minmax(0,100px) 1fr minmax(0,112px);gap:10px;padding:12px 14px;background:#fff;border-bottom:1px solid #e8edf5;font-size:12px;align-items:center}',
'.qca-hist b{color:#314d7d}.qca-hist small{display:block;color:#8490a3;margin-top:4px;font-size:10px}',
'@media(max-width:650px){.qca-grid{grid-template-columns:1fr}.qca-hist{grid-template-columns:74px 1fr 62px;font-size:11px;gap:5px;padding:10px}}'
].join('\n');
document.head.appendChild(style);
var plans=document.getElementById('plans'),history=document.getElementById('history');
plans?.parentNode?.insertBefore(root,plans);
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function dayIsCurrent(){return (document.getElementById('dateLabel')?.textContent||'').includes('10月21日')}
function project(){return document.querySelector('#tabs button.active')?.dataset.type||'direction'}
function readableMarket(kind){return ({had:'普通胜平负',hhad:'官方让球',hafu:'半全场',ttg:'总进球',crs:'比分'})[kind]||kind}
function pickLabel(leg){return (leg.selections||[]).map(function(s){return '<span class="qca-pick">'+esc(s)+'</span>'}).join('')}
function hitStatus(row){return row.settlement_status==='settled'?(row.group_hit?'已命中':'未命中'):'待结算'}
function name(track){return track==='baseline'?'基准测试':'AI分析师精选'}
function card(row){
var details=(row.legs||[]).map(function(l){
var note=l.selection_source==='manual'
?'<div class="qca-diff">人工调整 · 原FINAL单选 '+esc(l.final_single||'—')+'；官方让球 '+esc(l.handicap??'—')+'</div>':'';
var result=l.ft&&l.ht?'<div class="qca-foot">全场 '+esc(l.ft)+' · 半场 '+esc(l.ht)+' · '+(l.leg_hit===true?'已中':l.leg_hit===false?'未中':'待核')+'</div>':'';
return '<div class="qca-leg"><b>'+esc(l.match_num)+'｜'+esc(l.home)+' vs '+esc(l.away)+'</b>'+
'<div class="qca-foot">'+esc(readableMarket(l.market_kind))+(l.handicap!==null&&l.handicap!==undefined?'（'+esc(l.handicap)+'）':'')+'</div>'+
'<div class="qca-picks">'+pickLabel(l)+'</div>'+note+result+'</div>';
}).join('');
var status=row.status==='candidate'?'研究候选 · 未发布':hitStatus(row);
return '<article class="qca-card '+(row.track==='ai_analyst'?'qca-ai':'')+'"><div class="qca-head"><strong>'+esc(name(row.track))+'</strong><span class="qca-tag">'+esc(status)+'</span></div>'+details+
'<div class="qca-foot">双场联合覆盖估计：'+esc(row.joint_coverage??'—')+'%'+
(row.rationale?'<div>'+esc(row.rationale)+'</div>':'')+'</div></article>';
}
function draw(){
if(!archive)return;
var currently=dayIsCurrent();root.hidden=!currently;plans.hidden=currently;
if(currently){
 var sub=archive.groups.filter(g=>g.project===project());
 root.innerHTML='<h3 class="qca-title">中央精选测试档案｜10月21日</h3>'+
 '<p class="qca-description">主模型已提交 · 独立后台档案｜'+esc(archive.submission_version)+
 '｜4组基准＋4组AI分析师｜只读研究记录</p>'+
 (archive.batch_status==='candidate'?'<div class="qca-alert">本批次仍处于研究候选状态，没有正式发布或赛后结算。仅网站管理员可查看，不计入公开命中率。</div>':'')+
 '<div class="qca-grid">'+sub.map(card).join('')+'</div>';
 var t=document.getElementById('dailyTitle'),meta=document.getElementById('dailyMeta');
 if(t)t.textContent='10月21日 · '+({direction:'方向',htft:'半全场',goals:'总进球',score:'比分'}[project()])+'精选测试';
 if(meta)meta.textContent=sub.length+'组（基准＋AI）';
}
if(history){
 history.querySelectorAll('[data-qc-submitted-row]').forEach(e=>e.remove());
 // Keep original 10/19 and 10/20 history; do not mix today's legacy auto pairs with central submitted records.
 if(currently)history.querySelectorAll('[data-open-date="2026-10-21"]').forEach(e=>e.remove());
 var related=archive.groups.filter(g=>g.project===project());
 var rows=related.map(g=>{
  var opponents=(g.legs||[]).map(l=>esc(l.match_num+' '+l.home)).join(' / ');
  return '<div class="qca-hist" data-qc-submitted-row="1"><span><b>10/21</b><small>'+esc(name(g.track))+'</small></span>'+
   '<span><b>'+opponents+'</b><small>'+esc((g.legs||[]).map(l=>(l.selections||[]).join(' / ')).join(' · '))+'</small></span>'+
   '<span>'+esc(hitStatus(g))+'</span></div>';
 }).join('');
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
 archive=r.data;queueDraw();
 window.qcSupabase.auth.onAuthStateChange(function(ev,session){
  if(!session){archive=null;root.hidden=true;plans.hidden=false;}
 });
}catch(e){console.warn('精选测试档案读取异常',String(e))}
}
start();
})();
