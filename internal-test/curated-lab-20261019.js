/* 球场档案 · 精选研究实验室 V0.1
   Completed-only retrospective; no live user activity, betting, payments or writes.
   Results are NEVER used to choose fixture pairs or options. */
(function(){
'use strict';
var db=window.QC_CURATED_LAB_DATA;
var $=function(id){return document.getElementById(id)};
var types={direction:{label:'方向 · 双场',desc:'赛前模型方向与同一官方玩法赔率；无胜平负的比赛使用让球方向。',color:'#315db3'},htft:{label:'半全场 · 双场',desc:'两场各取赛前锁定的半全场TOP2，分别与官方半全场赔率匹配。',color:'#8660b0'},goals:{label:'总进球 · 双场',desc:'从赛前锁板的独立进球区间读取选项，再匹配总进球官方赔率。',color:'#218a71'},score:{label:'比分 · 双场',desc:'每场最多使用锁定TOP3比分，两场形成最多9种精确比分组合。',color:'#b86670'}};
var modes={balanced:'平均覆盖',hot:'常规优先',cold:'逆向观察',hybrid:'攻防平衡'};
var state={day:null,type:'direction',budget:100,mode:'balanced',month:null,open:null,origin:null};
var dates=[];
var all=[];
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]})}
function money(v){var n=Number(v);if(!Number.isFinite(n))return '—';return n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function num(v){var n=Number(v);return Number.isFinite(n)?n:null}
function score(v){var m=String(v||'').match(/^([0-9]{1,2})\s*[:-]\s*([0-9]{1,2})$/);return m?{h:+m[1],a:+m[2]}:null}
function result(v){return v.h>v.a?'h':v.h<v.a?'a':'d'}
function mkt(row,key){return row.mk&&row.mk[key]||null}
function legTypeHit(row,type,key,market){
 var ft=score(row.ft),ht=score(row.ht);if(!ft||!ht)return false;
 if(type==='direction'){
   var vote=type==='direction' && market==='hhad' ? result({h:ft.h+Number(mkt(row,'hhad').line),a:ft.a}):result(ft);
   return key===vote;
 }
 if(type==='htft')return key===(result(ht)+result(ft));
 if(type==='goals'){var total=ft.h+ft.a;return key==='s7'?total>=7:key==='s'+total}
 if(type==='score'){var parts=key.match(/^s([0-9]{2})s([0-9]{2})$/);return !!parts&&+parts[1]===ft.h&&+parts[2]===ft.a}
 return false;
}
function option(row,market,key,label,type){
 var m=mkt(row,market),odd=num(m&&m.o&&m.o[key]);
 if(!odd||odd<=1)return null;
 return {key:key,name:label,odds:odd,market:market,hit:legTypeHit(row,type,key,market)};
}
function uniqueOptions(items){var seen=new Set();return items.filter(function(o){if(!o||seen.has(o.market+'/'+o.key))return false;seen.add(o.market+'/'+o.key);return true})}
function makeLeg(row,type){
 var options=[],market,parts,word,keys,byLetter={胜:'h',平:'d',负:'a',让胜:'h',让平:'d',让负:'a'},abc={胜:'h',平:'d',负:'a'};
 if(type==='direction'){
   market=String(row.direction||'').indexOf('让')>=0?'hhad':'had';
   if(!mkt(row,market))return null;
   parts=String(row.direction||'').split(/\s*[\/|｜]\s*/).map(function(x){return x.trim()}).filter(Boolean);
   if(market==='hhad')parts=parts.filter(function(x){return x.startsWith('让')});
   else parts=parts.filter(function(x){return ['胜','平','负'].includes(x)});
   options=parts.map(function(x){return option(row,market,byLetter[x],x,type)});
 }else if(type==='htft'){
   market='hafu';if(!mkt(row,market))return null;
   options=(row.htft||[]).slice(0,2).map(function(v){
     var p=String(v).split('/');if(p.length!==2)return null;
     return option(row,market,(abc[p[0]]||'')+(abc[p[1]]||''),String(v),type);
   });
 }else if(type==='goals'){
   market='ttg';if(!mkt(row,market))return null;
   parts=String(row.goals||'').match(/(?:[0-9]\+?)\s*球/g)||[];
   options=parts.slice(0,3).map(function(v){var found=v.match(/[0-9]/);if(!found)return null;return option(row,market,'s'+found[0],v,type)});
 }else if(type==='score'){
   market='crs';if(!mkt(row,market))return null;
   options=(row.scores||[]).slice(0,3).map(function(v){
      var sc=score(v);if(!sc)return null;
      return option(row,market,'s'+String(sc.h).padStart(2,'0')+'s'+String(sc.a).padStart(2,'0'),String(v),type);
   });
 }
 options=uniqueOptions(options).slice(0,3);
 if(!options.length)return null;
 return {row:row,options:options,market:market};
}
function plansFor(day,type){
 var items=all.filter(function(r){return r.d===day}).map(function(row){return makeLeg(row,type)}).filter(Boolean);
 // Stable source order: fixture number / kickoff. Absolutely no outcome or score-based ranking.
 items.sort(function(a,b){return String(a.row.num).localeCompare(String(b.row.num),'zh-Hans-CN',{numeric:true})});
 var pairs=[];for(var i=0;i+1<Math.min(items.length,6);i+=2){
   pairs.push({day:day,type:type,index:pairs.length+1,a:items[i],b:items[i+1]});
 }
 return pairs;
}
function combosFor(plan){
 var arr=[];
 for(var i=0;i<plan.a.options.length;i++)for(var j=0;j<plan.b.options.length;j++){
   var a=plan.a.options[i],b=plan.b.options[j],odds=+(a.odds*b.odds).toFixed(4);
   arr.push({a:a,b:b,odds:odds,hit:a.hit&&b.hit});
 }
 return arr;
}
function allocation(plan,budget,mode){
 var list=combosFor(plan);if(!list.length)return {list:[],returns:0,grossMin:0,grossMax:0,covered:false};
 var total=Math.round(Math.max(10,Math.min(100000,budget))*100);
 var weights=list.map(function(s){
   if(mode==='balanced')return 1/s.odds;
   if(mode==='hot')return Math.pow(1/s.odds,1.55);
   if(mode==='cold')return Math.pow(s.odds,.7);
   // Defensive half equal-result allocation, half price-implied.
   return .55/s.odds+.45*Math.pow(1/s.odds,1.55);
 });
 var sum=weights.reduce(function(a,b){return a+b},0),raw=weights.map(function(v){return total*v/sum}),units=raw.map(Math.floor);
 var remain=total-units.reduce(function(a,b){return a+b},0),indices=raw.map(function(v,i){return {i:i,frac:v-Math.floor(v)}}).sort(function(a,b){return b.frac-a.frac||a.i-b.i});
 for(var u=0;u<remain;u++)units[indices[u%indices.length].i]++;
 list.forEach(function(c,i){c.stake=units[i]/100;c.projected=c.stake*c.odds});
 var covered=list.some(function(c){return c.hit});
 var returned=list.reduce(function(acc,c){return acc+(c.hit?c.projected:0)},0);
 return {list:list,covered:covered,returns:returned,grossMin:Math.min.apply(null,list.map(function(x){return x.projected})),grossMax:Math.max.apply(null,list.map(function(x){return x.projected})),budget:total/100,mode:mode};
}
function readableDay(v){var d=new Date(v+'T12:00:00+08:00');return (d.getMonth()+1)+'月'+d.getDate()+'日 '+['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}
function idNum(row){return String(row.num||'').slice(-3)}
function parseScoreText(row){return row.ft?String(row.ft).replace(':','-'):'—'}
function miniLeg(leg){
 var row=leg.row,html='<div class="leg"><div class="leg-top"><b>'+esc(row.num)+'　'+esc(row.h)+' <span style="color:#a5adba;font-weight:500">vs</span> '+esc(row.a)+'</b><em>'+esc(row.league||'')+'</em></div>';
 html+='<div class="leg-meta">已锁定赛前研究 · '+(leg.market==='hhad'?'官方让球 '+esc(mkt(row,'hhad')?.line||''):esc(types[state.type].label.split(' · ')[0]))+'</div>';
 html+='<div class="chips">'+leg.options.map(function(o){return '<span class="chip '+(o.hit?'ok':'no')+'">'+esc(o.name)+' <i>×'+money(o.odds)+'</i>'+(o.hit?' ✓':'')+'</span>'}).join('')+'</div>';
 html+='<div class="leg-result">正式赛果：'+esc(parseScoreText(row))+'　半场 '+esc(String(row.ht||'—').replace(':','-'))+'</div></div>';
 return html;
}
function renderMetrics(){
 var n=all.length;
 $('metrics').innerHTML='<div class="metric"><small>已核验完赛样本</small><strong>'+n+'</strong><em>全部含赛前锁板与赛果</em></div><div class="metric"><small>历史业务日期</small><strong>'+dates.length+'</strong><em>仅演示已有样本</em></div><div class="metric"><small>研究方案类型</small><strong>04</strong><em>方向 / 半全场 / 进球 / 比分</em></div><div class="metric"><small>生产数据变更</small><strong>0</strong><em>仅浏览器计算</em></div>';
}
function rowStatus(sim){return sim.covered?'覆盖命中':'未覆盖'}
function planCard(plan){
 var calc=allocation(plan,state.budget,state.mode);
 return '<article class="plan"><div class="plan-head"><span class="plan-id">方案 '+String(plan.index).padStart(2,'0')+' <span style="font-weight:500;color:#94a0b1;margin-left:6px">'+esc(readableDay(plan.day))+'</span></span><span class="flag '+(calc.covered?'hit':'miss')+'">'+rowStatus(calc)+'</span></div><div class="legs">'+miniLeg(plan.a)+miniLeg(plan.b)+'</div><div class="plan-foot"><div class="plan-return"><small>模拟实际返还 · '+money(state.budget)+'点预算</small><strong class="'+(calc.covered?'':'null')+'">'+money(calc.returns)+' <span style="font-size:12px">点</span></strong></div><button class="inspect" data-open-date="'+esc(plan.day)+'" data-open-index="'+plan.index+'">查看四种分配 →</button></div></article>';
}
function renderPlans(){
 var plans=plansFor(state.day,state.type);
 $('dailyTitle').textContent=readableDay(state.day)+' · 回溯研究';
 $('dailyMeta').textContent=plans.length+'组方案 · '+(all.filter(function(r){return r.d===state.day}).length)+'场已完赛样本';
 $('plans').innerHTML=plans.map(planCard).join('')||'<div class="empty">这一日期没有两场具备该类已锁定选项和赛前赔率的比赛。<br>请切换日期或研究类别。</div>';
}
function renderHistory(){
 var html=[],n=0;
 for(var d=0;d<dates.length;d++){
   var day=dates[d],ps=plansFor(day,state.type);
   ps.forEach(function(plan){
     n++;var sim=allocation(plan,state.budget,state.mode);
     html.push('<button class="hist-row" data-open-date="'+esc(day)+'" data-open-index="'+plan.index+'"><span class="hist-day">'+esc(readableDay(day).split(' ')[0])+'</span><span class="hist-leg"><b>'+esc(idNum(plan.a.row))+' '+esc(plan.a.row.h)+' / '+esc(idNum(plan.b.row))+' '+esc(plan.b.row.h)+'</b><small>方案'+String(plan.index).padStart(2,'0')+' · '+esc(plan.a.options.map(function(o){return o.name}).join('+'))+' / '+esc(plan.b.options.map(function(o){return o.name}).join('+'))+'</small></span><span class="hist-amount">'+money(sim.returns)+'</span><span class="hist-status '+(sim.covered?'hit':'')+'">'+rowStatus(sim)+'</span></button>');
   });
 }
 $('history').innerHTML=html.join('')||'<div class="empty">此研究类别没有可回溯的组合。</div>';
}
function renderTabs(){
 document.querySelectorAll('#tabs button').forEach(function(el){var active=el.dataset.type===state.type;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active))});
 $('infoBand').innerHTML='<b>'+esc(types[state.type].label)+'</b>　'+esc(types[state.type].desc)+'<br>当前显示<strong>事后回溯重建</strong>，不计入历史提前发布命中率；金额单位为模拟点数。';
}
function renderDate(){
 $('dateLabel').innerHTML=esc(readableDay(state.day))+' <span>▾</span>';
 var idx=dates.indexOf(state.day);
 $('prevDate').disabled=idx===dates.length-1;
 $('nextDate').disabled=idx===0;
 $('budget').value=String(state.budget);
 document.querySelectorAll('[data-budget]').forEach(function(el){el.classList.toggle('selected',+el.dataset.budget===state.budget)});
}
function renderAll(){renderTabs();renderDate();renderPlans();renderHistory();if(state.open)renderDialog()}
function calendar(){
 var y=state.month.getFullYear(),mo=state.month.getMonth(),first=new Date(y,mo,1).getDay(),days=new Date(y,mo+1,0).getDate(),html='';
 $('monthLabel').textContent=y+'年'+(mo+1)+'月';
 ['日','一','二','三','四','五','六'].forEach(function(s){html+='<span>'+s+'</span>'});
 for(var i=0;i<first;i++)html+='<span></span>';
 for(var d=1;d<=days;d++){
   var iso=y+'-'+String(mo+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
   var enabled=dates.includes(iso);
   html+='<button type="button" data-date="'+iso+'" class="'+(state.day===iso?'active':'')+'" '+(enabled?'':'disabled')+'>'+d+'</button>';
 }
 $('calDays').innerHTML=html;
 var monthPresent=dates.map(function(d){return d.slice(0,7)});
 var current=y+'-'+String(mo+1).padStart(2,'0');
 $('prevMonth').disabled=current<=monthPresent[monthPresent.length-1];
 $('nextMonth').disabled=current>=monthPresent[0];
}
function selectDay(v){if(!dates.includes(v))return;state.day=v;state.month=new Date(v+'T12:00:00+08:00');$('calendar').hidden=true;$('dateLabel').setAttribute('aria-expanded','false');renderAll()}
function strategyDescription(mode){
 if(mode==='balanced')return '按赔率倒数分配，使各互斥结果组合的理论返还尽可能接近；不是“稳赚”或“保本”。';
 if(mode==='hot')return '提高较低赔率结果的模拟分配比例，强调常规路径；只用于比较权重。';
 if(mode==='cold')return '提高较高赔率结果的模拟分配比例，用于逆向覆盖与敏感性观察。';
 return '在平均覆盖与常规优先之间折中，观察两类分配的结果差异。';
}
function dialogLeg(leg){
 var r=leg.row;
 return '<div class="detail-leg"><b>'+esc(r.num)+'｜'+esc(r.h)+' vs '+esc(r.a)+'</b><small>'+esc(r.league)+'　FT '+esc(parseScoreText(r))+'　HT '+esc(String(r.ht||'').replace(':','-'))+'</small><div class="chips">'+leg.options.map(function(o){return '<span class="chip '+(o.hit?'ok':'no')+'">'+esc(o.name)+' @'+money(o.odds)+(o.hit?' ✓':'')+'</span>'}).join('')+'</div></div>';
}
function renderDialog(){
 var q=state.open;if(!q)return;var plan=plansFor(q.day,q.type).find(function(p){return p.index===q.index});if(!plan)return;
 var sim=allocation(plan,state.budget,state.mode);
 $('dialogTitle').textContent=types[plan.type].label+'｜方案'+String(plan.index).padStart(2,'0');
 $('dialogSub').textContent=plan.day+' · 锁板字段回溯构建 · '+modes[state.mode]+'（非历史预发布）';
 document.querySelectorAll('#modeTabs button').forEach(function(el){var yes=el.dataset.mode===state.mode;el.classList.toggle('active',yes);el.setAttribute('aria-selected',String(yes))});
 var summary='<div class="summary"><div class="summary-item"><small>本组模拟预算</small><strong>'+money(state.budget)+'点</strong></div><div class="summary-item"><small>覆盖组合数</small><strong>'+sim.list.length+'种</strong></div><div class="summary-item"><small>回溯模拟返还</small><strong>'+money(sim.returns)+'点</strong></div></div>';
 var rows=sim.list.map(function(c,i){return '<tr class="'+(c.hit?'winner':'')+'"><td>'+String(i+1).padStart(2,'0')+'</td><td>'+esc(c.a.name)+' × '+esc(c.b.name)+'</td><td>'+money(c.odds)+'</td><td>'+money(c.stake)+'</td><td>'+money(c.projected)+'</td><td>'+(c.hit?'✓ 覆盖':'—')+'</td></tr>'}).join('');
 $('dialogBody').innerHTML='<div class="dialog-tip"><b>'+esc(modes[state.mode])+'：</b>'+esc(strategyDescription(state.mode))+'</div><div class="dialog-legs">'+dialogLeg(plan.a)+dialogLeg(plan.b)+'</div>'+summary+'<div class="alloc-title">分配明细 · '+sim.list.length+'种互斥结果组合</div><div class="alloc"><table><thead><tr><th>#</th><th>结果组合</th><th>组合赔率</th><th>模拟份额</th><th>理论返还</th><th>赛后</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="disclaimer">所有份额加总等于输入的模拟预算，实际回溯返还是命中组合份额×当时官方赔率；若没有命中则为0。结果筛选采用锁板选项，未使用最终赛果；但组合是在赛后重新组装，并非历史预发布记录。金额/倍率均为演示计算，无实际交易行为。</div>';
}
function openDetail(day,index){
 var plan=plansFor(day,state.type).find(function(p){return p.index===index});if(!plan)return;
 state.origin=document.activeElement;state.open={day:day,index:index,type:state.type};
 $('overlay').hidden=false;document.body.style.overflow='hidden';renderDialog();$('dialog').focus();
}
function closeDetail(){
 $('overlay').hidden=true;state.open=null;document.body.style.overflow='';if(state.origin&&typeof state.origin.focus==='function')state.origin.focus();
}
function copyText(){
 if(!state.open)return;
 var q=state.open,p=plansFor(q.day,q.type).find(function(p){return p.index===q.index});if(!p)return;
 var sim=allocation(p,state.budget,state.mode);
 var t=['球场档案｜精选研究实验室（回溯演示）',p.day+' '+types[p.type].label+' 方案'+p.index,'1. '+p.a.row.num+' '+p.a.row.h+' vs '+p.a.row.a+'：'+p.a.options.map(function(o){return o.name+' @'+money(o.odds)}).join(' / '),'2. '+p.b.row.num+' '+p.b.row.h+' vs '+p.b.row.a+'：'+p.b.options.map(function(o){return o.name+' @'+money(o.odds)}).join(' / '),modes[state.mode]+'｜模拟预算'+money(state.budget)+'点｜模拟返还'+money(sim.returns)+'点','此组由完赛后根据锁板与赛前赔率重建，不构成历史预发布或投注建议。'].join('\n');
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){var b=$('copyPlan');b.textContent='已复制';setTimeout(function(){b.textContent='复制研究摘要'},1600)}).catch(function(){window.prompt('复制方案摘要',t)});
 else window.prompt('复制方案摘要',t);
}
function attach(){
 $('tabs').addEventListener('click',function(e){var b=e.target.closest('button[data-type]');if(!b)return;state.type=b.dataset.type;state.open=null;renderAll()});
 $('prevDate').addEventListener('click',function(){var i=dates.indexOf(state.day);if(i<dates.length-1)selectDay(dates[i+1])});
 $('nextDate').addEventListener('click',function(){var i=dates.indexOf(state.day);if(i>0)selectDay(dates[i-1])});
 $('dateLabel').addEventListener('click',function(e){e.stopPropagation();$('calendar').hidden=!$('calendar').hidden;$('dateLabel').setAttribute('aria-expanded',String(!$('calendar').hidden));calendar()});
 $('calDays').addEventListener('click',function(e){var b=e.target.closest('[data-date]');if(b&&!b.disabled)selectDay(b.dataset.date)});
 $('prevMonth').addEventListener('click',function(){state.month.setMonth(state.month.getMonth()-1);calendar()});
 $('nextMonth').addEventListener('click',function(){state.month.setMonth(state.month.getMonth()+1);calendar()});
 document.addEventListener('click',function(e){if(!e.target.closest('.date-control')){$('calendar').hidden=true;$('dateLabel').setAttribute('aria-expanded','false')}});
 $('budget').addEventListener('input',function(e){var n=Number(e.target.value);if(Number.isFinite(n)&&n>=10&&n<=100000){state.budget=Math.round(n*100)/100;renderPlans();renderHistory();if(state.open)renderDialog();document.querySelectorAll('[data-budget]').forEach(function(b){b.classList.toggle('selected',+b.dataset.budget===state.budget)})}});
 $('budget').addEventListener('blur',function(){var n=Number(this.value);state.budget=Math.round(Math.min(100000,Math.max(10,Number.isFinite(n)?n:100))*100)/100;renderAll()});
 document.querySelectorAll('[data-budget]').forEach(function(b){b.addEventListener('click',function(){state.budget=+b.dataset.budget;renderAll()})});
 document.addEventListener('click',function(e){var b=e.target.closest('[data-open-date][data-open-index]');if(b)openDetail(b.dataset.openDate,+b.dataset.openIndex)});
 $('modeTabs').addEventListener('click',function(e){var b=e.target.closest('button[data-mode]');if(!b)return;state.mode=b.dataset.mode;renderDialog();renderPlans();renderHistory()});
 $('closeDialog').addEventListener('click',closeDetail);$('dialogCloseBottom').addEventListener('click',closeDetail);
 $('overlay').addEventListener('click',function(e){if(e.target===$('overlay'))closeDetail()});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(state.open)closeDetail();else $('calendar').hidden=true}});
 $('copyPlan').addEventListener('click',copyText);
}
function init(){
 if(!db||!Array.isArray(db.matches)||!db.matches.length){$('plans').innerHTML='<div class="empty">数据文件未加载。请刷新测试页面。</div>';return;}
 all=db.matches.filter(function(r){return score(r.ft)&&score(r.ht)&&r.mk&&r.id&&r.d});
 dates=Array.from(new Set(all.map(function(r){return r.d}))).sort().reverse();
 if(!dates.length){$('plans').innerHTML='<div class="empty">暂无可核验的完赛样本。</div>';return}
 state.day=dates[0];state.month=new Date(state.day+'T12:00:00+08:00');renderMetrics();attach();renderAll();
}
init();
})();