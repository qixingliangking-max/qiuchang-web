/* 球场档案精选方案：所有当日卡片共享原页面的详情弹窗。
   只使用本站已发布数据或登录管理员可读记录。 */
(function(){
'use strict';
var current=null, origin=null, selectedMode='balanced';
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(k){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]})}
function money(x){return typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}
function price(s){var x=Number(s);return Number.isFinite(x)&&x>1?x:null}
function key(m,label){
 var z={'胜':'h','平':'d','负':'a','让胜':'h','让平':'d','让负':'a'};
 if(m==='had'||m==='hhad')return z[label]||'';
 if(m==='hafu')return label.split('/').map(function(x){return z[x]||''}).join('');
 if(m==='ttg')return 's'+String(label).match(/\d+/)?.[0];
 if(m==='crs'){var p=String(label).split('-');return p.length===2?'s'+p[0].padStart(2,'0')+'s'+p[1].padStart(2,'0'):'';}
 return '';
}
function parseScore(s){var p=String(s||'').match(/^(\d+)\s*[:\-]\s*(\d+)$/);return p?{h:+p[1],a:+p[2]}:null}
function actual(m,ft,ht,line){
 var f=parseScore(ft),h=parseScore(ht);if(!f||!h)return null;
 var dir=function(a,b){return a>b?'胜':a<b?'负':'平'};
 if(m==='had')return dir(f.h,f.a);
 if(m==='hhad')return '让'+dir(f.h+Number(line||0),f.a);
 if(m==='hafu')return dir(h.h,h.a)+'/'+dir(f.h,f.a);
 if(m==='ttg')return (f.h+f.a>=7?'7+':f.h+f.a)+'球';
 if(m==='crs')return f.h+'-'+f.a;
 return null;
}
function readAdmin(){
 return window.QC_CURATED_ADMIN_ARCHIVE?.groups||[];
}
function readOdds(code,num){
 var rows=window.QC_CURATED_ADMIN_ODDS||[];
 return rows.find(function(x){return x.group_code===code&&x.match_num===num})?.outcomes||{};
}
function build(kind,code){
 if(kind==='addon'){
  var x=(window.QC_CURATED_EXTRA?.groups||[]).find(function(v){return v.project===code});
  if(!x)return null;
  return {type:x.project,label:'分析师加选',settled:x.settlement_status==='settled',
   legs:(x.legs||[]).map(function(l,i){
    var r=(x.leg_results||[]).find(function(k){return k.match_num===l.match_num})||{};
    return {num:l.match_num,home:l.home,away:l.away,market:l.market,line:l.line,
     ft:r.ft||null,ht:r.ht||null,options:(l.options||[]).map(function(o){return {name:o.label,odd:price(o.odd)}})};
   })};
 }
 var x=readAdmin().find(function(v){return v.group_code===code});
 if(!x)return null;
 return {type:x.project,label:x.track==='baseline'?'基准版':'AI精选版',settled:x.settlement_status==='settled',
  legs:(x.legs||[]).map(function(l){
   var odds=readOdds(code,l.match_num);
   return {num:l.match_num,home:l.home,away:l.away,market:l.market_kind,line:l.handicap,
    ft:l.ft||null,ht:l.ht||null,
    options:(l.selections||[]).map(function(name){return {name:name,odd:price(odds[key(l.market_kind,name)])}})};
  })};
}
function optionsCartesian(legs){
 var out=[[]];legs.forEach(function(l){
  var next=[];out.forEach(function(prev){l.options.forEach(function(o){next.push(prev.concat([{...o,leg:l}]))})});out=next;
 });return out;
}
function calculate(plan,mode,budget){
 var combos=optionsCartesian(plan.legs).map(function(items){
   var complete=items.every(function(v){return v.odd!==null});
   var odds=complete?items.reduce(function(p,v){return p*v.odd},1):null;
   var hit=plan.settled?items.every(function(v){return actual(v.leg.market,v.leg.ft,v.leg.ht,v.leg.line)===v.name}):false;
   return {items:items,odds:odds,hit:hit};
 });
 if(!combos.length)return {rows:[],returns:null,min:null,max:null,complete:false};
 var available=combos.every(function(v){return v.odds!==null});
 var total=Math.round(Math.min(100000,Math.max(10,budget))*100);
 var weights=combos.map(function(c){
  if(!available||mode==='balanced')return 1;
  if(mode==='hot')return Math.pow(1/c.odds,1.55);
  if(mode==='cold')return Math.pow(c.odds,.7);
  return .55/c.odds+.45*Math.pow(1/c.odds,1.55);
 });
 var sum=weights.reduce(function(a,b){return a+b},0),raw=weights.map(function(w){return total*w/sum});
 var cents=raw.map(Math.floor),remaining=total-cents.reduce(function(a,b){return a+b},0);
 var indices=raw.map(function(v,i){return{i:i,frac:v-Math.floor(v)}}).sort(function(a,b){return b.frac-a.frac||a.i-b.i});
 for(var k=0;k<remaining;k++)cents[indices[k%indices.length].i]++;
 var rows=combos.map(function(c,i){return {...c,amount:cents[i]/100,gross:c.odds===null?null:c.odds*cents[i]/100}});
 var gross=rows.map(function(c){return c.gross}).filter(function(n){return n!==null});
 return {rows:rows,complete:available,returns:plan.settled&&available?rows.reduce(function(a,c){return a+(c.hit?c.gross:0)},0):null,
 min:gross.length?Math.min.apply(null,gross):null,max:gross.length?Math.max.apply(null,gross):null};
}
function budget(){var v=Number($('budget')?.value);return Number.isFinite(v)?Math.min(100000,Math.max(10,v)):100}
function render(){
 if(!current)return;
 var plan=current,calc=calculate(plan,selectedMode,budget());
 var d={direction:'胜平负',htft:'半全场',goals:'总进球',score:'比分'};
 $('dialogTitle').textContent=(d[plan.type]||'精选')+(plan.legs.length===3?'三场':'双场')+' · '+plan.label;
 $('dialogSub').textContent='10月21日 周三 · '+plan.label+' · '+(plan.settled?'赛后回看':'待结算');
 document.querySelectorAll('#modeTabs button').forEach(function(b){var active=b.dataset.mode===selectedMode;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
 var legHtml=plan.legs.map(function(l){
  var known=plan.settled&&parseScore(l.ft)&&parseScore(l.ht);
  var meta=known?'FT '+esc(l.ft)+'　HT '+esc(l.ht):'赛前记录 · 待结算';
  var options=l.options.map(function(o){
   var hit=known&&actual(l.market,l.ft,l.ht,l.line)===o.name;
   return '<span class="chip '+(known?(hit?'ok':'no'):'')+'">'+esc(o.name)+(o.odd!==null?' @'+money(o.odd):'')+(hit?' ✓':'')+'</span>';
  }).join('');
  return '<div class="detail-leg"><b>'+esc(l.num)+'｜'+esc(l.home)+' vs '+esc(l.away)+'</b><small>'+meta+'</small><div class="chips">'+options+'</div></div>';
 }).join('');
 var range=calc.min!==null?money(calc.min)+'–'+money(calc.max)+'点':'—';
 var value=plan.settled&&calc.returns!==null?money(calc.returns)+'点':(calc.complete?range:'—');
 var summary='<div class="summary">'+
  '<div class="summary-item"><small>模拟金额</small><strong>'+money(budget())+'点</strong></div>'+
  '<div class="summary-item"><small>组合选项</small><strong>'+calc.rows.length+'种</strong></div>'+
  '<div class="summary-item"><small>'+(plan.settled?'模拟返还':'情景返还范围')+'</small><strong>'+value+'</strong></div></div>';
 var tableRows=calc.rows.map(function(r,i){
  var highlighted=plan.settled&&r.hit, names=r.items.map(function(v){return v.name}).join(' × ');
  return '<tr class="'+(highlighted?'winner':'')+'"><td>'+String(i+1).padStart(2,'0')+'</td><td>'+esc(names)+'</td>'+
   '<td>'+money(r.odds)+'</td><td>'+money(r.amount)+'</td><td>'+money(r.gross)+'</td>'+
   '<td>'+(plan.settled?(highlighted?'✓':'—'):'待赛果')+'</td></tr>';
 }).join('');
 var notes=calc.complete?'所有组合等额分配或按所选策略调整，方便对比不同赔率结构。':
  '部分选项尚无可核验的赛前赔率，仅展示真实选项，不计算对应返还。';
 $('dialogBody').innerHTML='<div class="dialog-tip">'+notes+'</div>'+
 '<div class="dialog-legs">'+legHtml+'</div>'+summary+
 '<div class="alloc-title">组合分配</div><div class="alloc"><table><thead><tr><th>#</th><th>组合</th><th>赔率</th><th>份额</th><th>理论返还</th><th>'+(plan.settled?'命中':'状态')+'</th></tr></thead><tbody>'+
 tableRows+'</tbody></table></div><div class="disclaimer">赛后回看仅供赛事研究，不代表实际收益；仅供看球讨论。</div>';
}
function open(kind,code){
 var plan=build(kind,code);if(!plan||!plan.legs.length)return;
 current=plan;selectedMode='balanced';origin=document.activeElement;
 $('overlay').hidden=false;document.body.style.overflow='hidden';render();$('dialog').focus();
}
function close(){if(!current)return;current=null;$('overlay').hidden=true;document.body.style.overflow='';if(origin&&typeof origin.focus==='function')origin.focus();}
function copy(){
 if(!current)return;
 var x=current,b=calculate(x,selectedMode,budget());
 var txt=['球场档案｜'+x.label,x.legs.map(function(l){return l.num+' '+l.home+' vs '+l.away+': '+l.options.map(function(o){return o.name+(o.odd!==null?' @'+money(o.odd):'')}).join(' / ')}).join('\n'),
 '组合'+b.rows.length+'种｜模拟金额'+money(budget())+'点','仅供看球讨论。'].join('\n');
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).then(function(){$('copyPlan').textContent='已复制';setTimeout(function(){$('copyPlan').textContent='复制方案'},1600)}).catch(function(){window.prompt('复制方案摘要',txt)});
 else window.prompt('复制方案摘要',txt);
}
document.addEventListener('click',function(e){
 var el=e.target.closest('[data-qc-detail-kind]');
 if(el){e.preventDefault();open(el.dataset.qcDetailKind,el.dataset.qcDetailCode);return;}
 if(!current)return;
 if(e.target.closest('#closeDialog')||e.target.closest('#dialogCloseBottom')||(e.target.id==='overlay')){close();return;}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&current){e.preventDefault();close();}});
$('modeTabs')?.addEventListener('click',function(e){if(!current)return;var b=e.target.closest('button[data-mode]');if(b){selectedMode=b.dataset.mode;render();}});
$('budget')?.addEventListener('input',function(){if(current)render();});
$('budget')?.addEventListener('blur',function(){if(current)render();});
$('copyPlan')?.addEventListener('click',function(){if(current)copy();});
window.QC_CURATED_OPEN_DETAILS=open;
})();