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
 var pack=db.selectedPlans&&db.selectedPlans[day];
 if(pack){
   var record=(pack.entries||[]).find(function(e){return e.type===type});
   if(!record||record.legs.length!==2)return [];
   var legs=record.legs.map(function(leg){
     var opts=leg.picks.map(function(p){return option(leg.row,leg.market,p.key,p.name,type)});
     if(opts.some(function(o){return !o}))return null;
     return {row:leg.row,market:leg.market,options:opts};
   });
   if(legs.some(function(l){return !l}))return [];
   return [{day:day,type:type,index:1,a:legs[0],b:legs[1],prematch:true}];
 }
 var items=all.filter(function(r){return r.d===day}).map(function(row){return makeLeg(row,type)}).filter(Boolean);
 items.sort(function(a,b){return String(a.row.num).localeCompare(String(b.row.num),'zh-Hans-CN',{numeric:true})});
 var pairs=[];for(var i=0;i+1<Math.min(items.length,6);i+=2) pairs.push({day:day,type:type,index:pairs.length+1,a:items[i],b:items[i+1]});
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
function readableDay(v){var d=new Date(v+'T12:00:00');return (d.getMonth()+1)+'月'+d.getDate()+'日 '+['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}
function idNum(row){return String(row.num||'').slice(-3)}
function parseScoreText(row){return row.ft?String(row.ft).replace(':','-'):'—'}
function miniLeg(leg){
 var row=leg.row,pending=!score(row.ft)||!score(row.ht);
 var html='<div class="leg"><div class="leg-top"><b>'+esc(row.num)+'　'+esc(row.h)+' <span style="color:#a5adba;font-weight:500">vs</span> '+esc(row.a)+'</b><em>'+esc(row.league||'')+'</em></div>';
 html+='<div class="chips">'+leg.options.map(function(o){return '<span class="chip '+(pending?'':o.hit?'ok':'no')+'">'+esc(o.name)+' <i>×'+money(o.odds)+'</i>'+(pending?'':o.hit?' ✓':'')+'</span>'}).join('')+'</div>';
 html+='<div class="leg-result">'+(pending?'官方赛前赔率 · 待赛':'赛果 '+esc(parseScoreText(row))+' <span style="color:#97a4b4">｜</span> 半场 '+esc(String(row.ht||'—').replace(':','-')))+'</div></div>';
 return html;
}
function renderMetrics(){ /* 样本数与技术指标不在用户首屏展示 */ }
function rowStatus(sim){return sim.covered?'命中':'未命中'}
function planCard(plan){
 var calc=allocation(plan,state.budget,state.mode);
 if(plan.prematch){
   var oddList=calc.list.map(function(x){return x.odds});
   var textOdd=oddList.length===1?'×'+money(oddList[0]):'×'+money(Math.min.apply(null,oddList))+'—'+money(Math.max.apply(null,oddList));
   return '<article class="plan"><div class="plan-head"><span class="plan-id">方案 '+String(plan.index).padStart(2,'0')+'</span><span class="flag pending">待赛 · 赛前赔率</span></div><div class="legs">'+miniLeg(plan.a)+miniLeg(plan.b)+'</div><div class="plan-foot"><div class="plan-return"><small>组合赔率 · '+calc.list.length+'种</small><strong>'+textOdd+'</strong></div><button class="inspect" data-open-date="'+esc(plan.day)+'" data-open-index="'+plan.index+'">方案详情 →</button></div></article>';
 }
 return '<article class="plan"><div class="plan-head"><span class="plan-id">方案 '+String(plan.index).padStart(2,'0')+'</span><span class="flag '+(calc.covered?'hit':'miss')+'">'+rowStatus(calc)+'</span></div><div class="legs">'+miniLeg(plan.a)+miniLeg(plan.b)+'</div><div class="plan-foot"><div class="plan-return"><small>模拟返还 · '+money(state.budget)+'点</small><strong class="'+(calc.covered?'':'null')+'">'+money(calc.returns)+' <span style="font-size:12px">点</span></strong></div><button class="inspect" data-open-date="'+esc(plan.day)+'" data-open-index="'+plan.index+'">方案详情 →</button></div></article>';
}
function renderPlans(){
 var plans=plansFor(state.day,state.type);
 $('dailyTitle').textContent=readableDay(state.day)+' · 精选方案';
 $('dailyMeta').textContent='共'+plans.length+'组';
 $('plans').innerHTML=plans.map(planCard).join('')||'<div class="empty">当日暂无该类组合<br>可切换其他日期或类别查看。</div>';
}
function renderHistory(){
 var html=[],n=0;
 for(var d=0;d<dates.length;d++){
   var day=dates[d];if(db.selectedPlans&&db.selectedPlans[day])continue;
   var ps=plansFor(day,state.type);
   ps.forEach(function(plan){
     n++;var sim=allocation(plan,state.budget,state.mode);
     html.push('<button class="hist-row" data-open-date="'+esc(day)+'" data-open-index="'+plan.index+'"><span class="hist-day">'+esc(readableDay(day).split(' ')[0])+'</span><span class="hist-leg"><b>'+esc(idNum(plan.a.row))+' '+esc(plan.a.row.h)+' / '+esc(idNum(plan.b.row))+' '+esc(plan.b.row.h)+'</b><small>方案'+String(plan.index).padStart(2,'0')+' · '+esc(plan.a.options.map(function(o){return o.name}).join('+'))+' / '+esc(plan.b.options.map(function(o){return o.name}).join('+'))+'</small></span><span class="hist-amount">'+money(sim.returns)+'</span><span class="hist-status '+(sim.covered?'hit':'')+'">'+rowStatus(sim)+'</span></button>');
   });
 }
 $('history').innerHTML=html.join('')||'<div class="empty">此研究类别没有可回溯的组合。</div>';
}
function renderTabs(){
 document.querySelectorAll('#tabs button').forEach(function(el){var active=el.dataset.type===state.type;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active))});
 $('infoBand').textContent=(db.selectedPlans&&db.selectedPlans[state.day])?'10月19日精选方案 · 官方赛前赔率已匹配，尚未结算。':'历史模拟 · 组合为事后回溯生成，并非当时赛前发布。';
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
function selectDay(v){if(!dates.includes(v))return;state.day=v;state.month=new Date(v+'T12:00:00');$('calendar').hidden=true;$('dateLabel').setAttribute('aria-expanded','false');renderAll()}
function strategyDescription(mode){
 if(mode==='balanced')return '各组合按赔率调整份额，使模拟返还尽量接近。';
 if(mode==='hot')return '更侧重较低赔率的常规结果。';
 if(mode==='cold')return '更侧重较高赔率的结果。';
 return '兼顾均衡覆盖与常规结果。';
}
function dialogLeg(leg){
 var r=leg.row,pending=!score(r.ft)||!score(r.ht),captured=(mkt(r,leg.market)||{}).captured;
 return '<div class="detail-leg"><b>'+esc(r.num)+'｜'+esc(r.h)+' vs '+esc(r.a)+'</b><small>'+esc(r.league)+'　'+(pending?'赛前赔率'+(captured?' · 采集于 '+esc(captured.slice(0,10)):''):'FT '+esc(parseScoreText(r))+'　HT '+esc(String(r.ht||'').replace(':','-')))+'</small><div class="chips">'+leg.options.map(function(o){return '<span class="chip '+(pending?'':o.hit?'ok':'no')+'">'+esc(o.name)+' @'+money(o.odds)+(pending?'':o.hit?' ✓':'')+'</span>'}).join('')+'</div></div>';
}
function renderDialog(){
 var q=state.open;if(!q)return;var plan=plansFor(q.day,q.type).find(function(p){return p.index===q.index});if(!plan)return;
 var sim=allocation(plan,state.budget,state.mode),pending=!!plan.prematch;
 var displayType={direction:'方向',htft:'半全场',goals:'总进球',score:'比分'}[plan.type]||'双场';
 $('dialogTitle').textContent=displayType+'双场 · 方案'+String(plan.index).padStart(2,'0');
 $('dialogSub').textContent=readableDay(plan.day)+(pending?' · 赛前精选 · 官方赔率':' · 历史模拟');
 document.querySelectorAll('#modeTabs button').forEach(function(el){var yes=el.dataset.mode===state.mode;el.classList.toggle('active',yes);el.setAttribute('aria-selected',String(yes))});
 var range=money(sim.grossMin)+'–'+money(sim.grossMax);
 var summary='<div class="summary"><div class="summary-item"><small>模拟金额</small><strong>'+money(state.budget)+'点</strong></div><div class="summary-item"><small>组合选项</small><strong>'+sim.list.length+'种</strong></div><div class="summary-item"><small>'+(pending?'情景返还范围':'模拟返还')+'</small><strong>'+(pending?range:money(sim.returns)+'点')+'</strong></div></div>';
 var rows=sim.list.map(function(c,i){return '<tr class="'+(!pending&&c.hit?'winner':'')+'"><td>'+String(i+1).padStart(2,'0')+'</td><td>'+esc(c.a.name)+' × '+esc(c.b.name)+'</td><td>'+money(c.odds)+'</td><td>'+money(c.stake)+'</td><td>'+money(c.projected)+'</td><td>'+(pending?'待赛':c.hit?'✓':'—')+'</td></tr>'}).join('');
 $('dialogBody').innerHTML='<div class="dialog-tip">'+esc(strategyDescription(state.mode))+'</div><div class="dialog-legs">'+dialogLeg(plan.a)+dialogLeg(plan.b)+'</div>'+summary+'<div class="alloc-title">组合分配</div><div class="alloc"><table><thead><tr><th>#</th><th>组合</th><th>赔率</th><th>份额</th><th>理论返还</th><th>'+(pending?'状态':'命中')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="disclaimer">'+(pending?'仅为赛前赔率及分配情景模拟。理论返还是假定单一组合满足条件时的计算结果，尚未结算，不代表实际收益，也不构成投注建议。':'历史回溯计算，仅供数据研究。并非赛前实际发布记录，也不代表真实收益。')+'</div>';
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
 var sim=allocation(p,state.budget,state.mode),pending=!!p.prematch;
 var t=['球场档案｜精选方案',p.day+' '+types[p.type].label+' 方案'+p.index,
 '1. '+p.a.row.num+' '+p.a.row.h+' vs '+p.a.row.a+'：'+p.a.options.map(function(o){return o.name+' @'+money(o.odds)}).join(' / '),
 '2. '+p.b.row.num+' '+p.b.row.h+' vs '+p.b.row.a+'：'+p.b.options.map(function(o){return o.name+' @'+money(o.odds)}).join(' / '),
 modes[state.mode]+'｜模拟预算'+money(state.budget)+'点｜组合'+sim.list.length+'种',
 pending?'赛前赔率与组合演示，尚未结算。':('历史模拟返还'+money(sim.returns)+'点 · 历史回溯演示，非当时赛前发布。'),
 '数据研究，不构成投注建议。'].join('\n');
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){var b=$('copyPlan');b.textContent='已复制';setTimeout(function(){b.textContent='复制方案'},1600)}).catch(function(){window.prompt('复制方案摘要',t)});
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
 // Never replace the cards on input blur: clicking "查看" after editing would
 // otherwise remove the target between pointerdown and click.
 $('budget').addEventListener('blur',function(){var n=Number(this.value),before=state.budget;state.budget=Math.round(Math.min(100000,Math.max(10,Number.isFinite(n)?n:100))*100)/100;this.value=String(state.budget);if(state.budget!==before){renderPlans();renderHistory();if(state.open)renderDialog()}});
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
 dates=Array.from(new Set(all.map(function(r){return r.d}).concat(Object.keys(db.selectedPlans||{})))).sort().reverse();
 if(!dates.length){$('plans').innerHTML='<div class="empty">暂无可核验的完赛样本。</div>';return}
 state.day=dates[0];state.month=new Date(state.day+'T12:00:00');renderMetrics();attach();renderAll();
}
init();
})();