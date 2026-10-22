/* 球场档案 · 精选研究实验室 V0.1
   Completed-only retrospective; no live user activity, betting, payments or writes.
   Results are NEVER used to choose fixture pairs or options. */
(function(){
'use strict';
var db=window.QC_CURATED_LAB_DATA;
var blind=window.QC_CURATED_BLIND_SELECTION_V1;
var settled=window.QC_CURATED_BLIND_SETTLEMENT_V1;
var $=function(id){return document.getElementById(id)};
var types={direction:{label:'方向 · 双场',desc:'赛前模型方向与同一官方玩法赔率；无胜平负的比赛使用让球方向。',color:'#315db3'},htft:{label:'半全场 · 双场',desc:'两场各取赛前锁定的半全场TOP2，分别与官方半全场赔率匹配。',color:'#8660b0'},goals:{label:'总进球 · 双场',desc:'从赛前锁板的独立进球区间读取选项，再匹配总进球官方赔率。',color:'#218a71'},score:{label:'比分 · 双场',desc:'每场最多使用锁定TOP3比分，两场形成最多9种精确比分组合。',color:'#b86670'}};
var modes={balanced:'平均分配',hot:'常规优先',cold:'逆向观察',hybrid:'攻防平衡'};
var state={day:null,type:'direction',budget:100,mode:'balanced',month:null,open:null,origin:null,reveal:false};
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
   var versions=[
     {entries:pack.entries||[],label:pack.originalLabel||'原方案',note:pack.originalNote||'',id:'original',shadow:false,index:1},
     pack.aiSelector&&{entries:pack.aiSelector.entries||[],label:pack.aiSelector.label||'AI精选师 V1',note:pack.aiSelector.note||'',id:'shadow-v1',shadow:true,index:2},
     pack.analystSelector&&{entries:pack.analystSelector.entries||[],label:pack.analystSelector.label||'赛事分析师加选',note:pack.analystSelector.note||'',id:'analyst',shadow:true,index:3}
   ].filter(Boolean);
   return versions.map(function(version){
     var record=version.entries.find(function(e){return e.type===type});
     if(!record||!record.legs||record.legs.length<2||record.legs.length>3)return null;
     var legs=record.legs.map(function(leg){
       var opts=leg.picks.map(function(p){return option(leg.row,leg.market,p.key,p.name,type)});
       if(opts.some(function(o){return !o}))return null;
       return {row:leg.row,market:leg.market,options:opts};
     });
     if(legs.some(function(l){return !l}))return null;
     var settledRecord=record.legs.every(function(l){return score(l.row.ft)&&score(l.row.ht)});
     return {day:day,type:type,index:version.index,a:legs[0],b:legs[1],legs:legs,prematch:!settledRecord,
       variant:version.id,versionLabel:version.label,versionNote:record.note||version.note||'',versionGate:record.gate||'',shadow:version.shadow};
   }).filter(Boolean);
 }
 var pack2=blind&&blind.days&&blind.days[day];
 if(pack2){
   var entry=(pack2.entries||[]).find(function(e){return e.type===type});
   if(!entry)return [];
   var check=settled&&settled.dates&&settled.dates[day]&&settled.dates[day].items.find(function(e){return e.type===type});
   var unresolved=!!(check&&check.legResults.some(function(x){return !score(x.ft)||!score(x.ht)}));
   var legs=entry.legs.map(function(l,index){
     var row=Object.assign({},l.row,{mk:l.row.mk,blindMasked:!state.reveal,blindPending:unresolved});
     if(state.reveal&&check&&check.legResults[index]){
       row.ft=check.legResults[index].ft;
       row.ht=check.legResults[index].ht;
     }
     var opts=l.picks.map(function(p){return option(row,l.market,p.key,p.name,type)});
     if(opts.some(function(o){return !o}))return null;
     return {row:row,market:l.market,options:opts,blind:true};
   });
   if(legs.some(function(x){return !x}))return [];
   return [{day:day,type:type,index:1,a:legs[0],b:legs[1],blind:true,
       prematch:!state.reveal||unresolved,unsettled:unresolved,shadow:true,
       versionLabel:'AI精选师V1.0 · 遮挡回测',versionNote:'历史遮挡回放（非当日真实发布）；仅使用赛前锁板和官方赔率。',
       versionGate:unresolved?'待结算':''}];
 }
 var items=all.filter(function(r){return r.d===day}).map(function(row){return makeLeg(row,type)}).filter(Boolean);
 items.sort(function(a,b){return String(a.row.num).localeCompare(String(b.row.num),'zh-Hans-CN',{numeric:true})});
 var pairs=[];for(var i=0;i+1<Math.min(items.length,6);i+=2) pairs.push({day:day,type:type,index:pairs.length+1,a:items[i],b:items[i+1]});
 return pairs;
}
function planLegs(plan){return plan.legs||[plan.a,plan.b].filter(Boolean)}
function combosFor(plan){
 var arr=[{options:[],odds:1,hit:true}];
 planLegs(plan).forEach(function(leg){
  var next=[];
  arr.forEach(function(c){leg.options.forEach(function(o){
   next.push({options:c.options.concat([o]),odds:+(c.odds*o.odds).toFixed(4),hit:c.hit&&o.hit});
  })});
  arr=next;
 });
 return arr.map(function(c){c.a=c.options[0];c.b=c.options[1];return c});
}
function allocation(plan,budget,mode){
 var list=combosFor(plan);if(!list.length)return {list:[],returns:0,grossMin:0,grossMax:0,covered:false};
 var total=Math.round(Math.max(10,Math.min(100000,budget))*100);
 var weights=list.map(function(s){
   if(mode==='balanced')return 1; // True equal allocation; prior weighted formula mislabeled.
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
function renderTabs(){
 document.querySelectorAll('#tabs button').forEach(function(el){var active=el.dataset.type===state.type;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active))});
 var selected=!!(db.selectedPlans&&db.selectedPlans[state.day]),backtest=!!(blind&&blind.days&&blind.days[state.day]);
 $('infoBand').textContent=selected?'10月19日双版本对照 · 原方案与AI精选师V1影子测试并排展示，赔率来自赛前快照，均未结算。':backtest?'历史赛果遮挡回测 · 四类精选方案先冻结、后揭晓，非比赛当日真实发布。':'历史演示 · 组合为事后回溯生成，并非当时赛前发布。';
 $('revealRow').hidden=!backtest;
 $('revealBlind').textContent=state.reveal?'隐藏回测赛果':'揭晓回测赛果';
 $('revealBlind').setAttribute('aria-pressed',String(state.reveal));
}
function renderDate(){
 $('dateLabel').innerHTML=esc(readableDay(state.day))+' <span>▾</span>';
 var idx=dates.indexOf(state.day);
 $('prevDate').disabled=idx===dates.length-1;
 $('nextDate').disabled=idx===0;
 $('budget').value=String(state.budget);
 document.querySelectorAll('[data-budget]').forEach(function(el){el.classList.toggle('selected',+el.dataset.budget===state.budget)});
}
function miniLeg(leg){
 var row=leg.row,pending=!score(row.ft)||!score(row.ht);
 var html='<div class="leg"><div class="leg-top"><b>'+esc(row.num)+'　'+esc(row.h)+' <span style="color:#a5adba;font-weight:500">vs</span> '+esc(row.a)+'</b><em>'+esc(row.league||'')+'</em></div>';
 html+='<div class="chips">'+leg.options.map(function(o){return '<span class="chip '+(pending?'':o.hit?'ok':'no')+'">'+esc(o.name)+' <i>×'+money(o.odds)+'</i>'+(pending?'':o.hit?' ✓':'')+'</span>'}).join('')+'</div>';
 var pendingLabel=row.blindMasked?'赛果已遮挡':row.blindPending?'比赛中断 · 待结算':'官方赛前赔率 · 待赛';
 html+='<div class="leg-result">'+(pending?pendingLabel:'赛果 '+esc(parseScoreText(row))+' <span style="color:#97a4b4">｜</span> 半场 '+esc(String(row.ht||'—').replace(':','-')))+'</div></div>';
 return html;
}
function renderMetrics(){ /* 样本数与技术指标不在用户首屏展示 */ }
function rowStatus(sim){return sim.covered?'命中':'未命中'}
function planCard(plan){
 var calc=allocation(plan,state.budget,state.mode);
 if(plan.blind){
   var oddsList=calc.list.map(function(c){return c.odds}),minOdds=Math.min.apply(null,oddsList),maxOdds=Math.max.apply(null,oddsList);
   var masked=!state.reveal,status=masked?'赛果遮挡':plan.unsettled?'待结算':calc.covered?'命中':'未命中';
   var tag=masked||plan.unsettled?'pending':calc.covered?'hit':'miss';
   var showReturn=!masked&&!plan.unsettled;
   var note='<p class="version-note">历史赛果遮挡回放（非当日真实发布）；先冻结方案，后读取比赛结果。</p>';
   return '<article class="plan variant-shadow"><div class="plan-head"><span class="plan-id">'+esc(plan.versionLabel)+'</span><span class="flag '+tag+'">'+status+'</span></div><div class="legs">'+planLegs(plan).map(miniLeg).join('')+'</div>'+note+
   '<div class="plan-foot"><div class="plan-return"><small>'+(showReturn?'模拟返还 · '+money(state.budget)+'点':'组合赔率 · '+calc.list.length+'种')+'</small><strong>'+
   (showReturn?money(calc.returns)+' <span style="font-size:12px">点</span>':'×'+money(minOdds)+(Math.abs(minOdds-maxOdds)>0.0001?'—'+money(maxOdds):''))+'</strong></div><button class="inspect" data-open-date="'+esc(plan.day)+'" data-open-index="1">方案详情 →</button></div></article>';
 }
 if(plan.prematch){
   var oddList=calc.list.map(function(x){return x.odds});
   var textOdd=oddList.length===1?'×'+money(oddList[0]):'×'+money(Math.min.apply(null,oddList))+'—'+money(Math.max.apply(null,oddList));
   var title=esc(plan.versionLabel||'赛前精选'),note=plan.versionNote?'<p class="version-note">'+esc(plan.versionNote)+'</p>':'';
   var risk=plan.shadow?(plan.versionGate==='高风险观察'?' · 高风险':plan.versionGate==='赔率时效复核'?' · 赔率待核':' · 影子研究'):'';
   return '<article class="plan variant-'+(plan.shadow?'shadow':'original')+'"><div class="plan-head"><span class="plan-id">'+title+'</span><span class="flag pending">待赛'+esc(risk)+'</span></div><div class="legs">'+planLegs(plan).map(miniLeg).join('')+'</div>'+note+'<div class="plan-foot"><div class="plan-return"><small>组合赔率 · '+calc.list.length+'种</small><strong>'+textOdd+'</strong></div><button class="inspect" data-open-date="'+esc(plan.day)+'" data-open-index="'+plan.index+'">方案详情 →</button></div></article>';
 }
 return '<article class="plan"><div class="plan-head"><span class="plan-id">方案 '+String(plan.index).padStart(2,'0')+'</span><span class="flag '+(calc.covered?'hit':'miss')+'">'+rowStatus(calc)+'</span></div><div class="legs">'+planLegs(plan).map(miniLeg).join('')+'</div><div class="plan-foot"><div class="plan-return"><small>模拟返还 · '+money(state.budget)+'点</small><strong class="'+(calc.covered?'':'null')+'">'+money(calc.returns)+' <span style="font-size:12px">点</span></strong></div><button class="inspect" data-open-date="'+esc(plan.day)+'" data-open-index="'+plan.index+'">方案详情 →</button></div></article>';
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
   plansFor(day,state.type).forEach(function(plan){
     n++;var sim=allocation(plan,state.budget,state.mode);
     var hidden=plan.blind&&!state.reveal,unsettled=plan.blind&&plan.unsettled;
     var status=hidden?'遮挡':unsettled?'待结算':rowStatus(sim);
     var amount=hidden?'—':unsettled?'待结算':money(sim.returns);
     var title=plan.blind?'冻结精选V1':'方案'+String(plan.index).padStart(2,'0');
     html.push('<button class="hist-row" data-open-date="'+esc(day)+'" data-open-index="'+plan.index+'"><span class="hist-day">'+esc(readableDay(day).split(' ')[0])+'</span><span class="hist-leg"><b>'+esc(planLegs(plan).map(function(l){return idNum(l.row)+' '+l.row.h}).join(' / '))+'</b><small>'+esc(title)+' · '+esc(planLegs(plan).map(function(l){return l.options.map(function(o){return o.name}).join('+')}).join(' / '))+'</small></span><span class="hist-amount">'+amount+'</span><span class="hist-status '+(!hidden&&!unsettled&&sim.covered?'hit':'')+'">'+status+'</span></button>');
   });
 }
 $('history').innerHTML=html.join('')||'<div class="empty">此研究类别没有可回溯的组合。</div>';
}
function singleHalfReturns(plan){
 var legs=[plan.a,plan.b],returned=0;
 for(var k=0;k<legs.length;k++){
   var opts=legs[k].options,n=opts.length,unit=Math.floor(50000/n),remain=50000-unit*n;
   for(var j=0;j<n;j++)if(opts[j].hit)returned+=(unit+(j<remain?1:0))/100*opts[j].odds;
 }
 return Math.round(returned*100)/100;
}
function renderCompare(){
 var block=$('compareSection'),backtest=!!(blind&&blind.days&&blind.days[state.day]);block.hidden=!backtest;
 if(!backtest)return;
 if(!state.reveal){
   $('compareBody').innerHTML='<p class="compare-mask">当前已遮挡比分与收益。点击上方「揭晓回测赛果」，查看本日1000点双场、两场分别单场的差异。</p>';
   $('dailyReview').innerHTML='<p class="compare-mask">14天逐日净盈亏在揭晓后显示。</p>';
   return;
 }
 var current=plansFor(state.day,state.type)[0];
 if(!current||current.unsettled){
   $('compareBody').innerHTML='<p class="compare-mask">该组涉及中断比赛，暂不结算，不计入亏损。</p>';
 }else{
   var pair=allocation(current,1000,'balanced').returns,single=singleHalfReturns(current);
   function compareCard(label,value){
     var net=value-1000;
     return '<div class="compare-cell"><small>'+label+' · 1000点</small><strong>'+money(value)+'</strong><span class="'+(net>=0?'positive':'negative')+'">净'+(net>=0?'+':'−')+money(Math.abs(net))+'</span></div>';
   }
   $('compareBody').innerHTML='<div class="compare-grid">'+compareCard('双场等额2串1',pair)+compareCard('两场分别单场 · 各500点',single)+'</div><p class="compare-disclaimer">仅做赔率与组合结构比较；单场是独立结算的假设模拟，尚未核实具体比赛是否支持官方单关。</p>';
 }
 var types=['direction','htft','goals','score'],days=Object.keys(blind.days).sort(),stakeTotal=0,grossTotal=0,rows=[];
 function tdNet(val){return val===null?'<td>待结算</td>':'<td class="'+(val>=0?'positive':'negative')+'">'+(val>=0?'+':'−')+money(Math.abs(val))+'</td>';}
 for(var i=0;i<days.length;i++){
   var day=days[i],dayStake=0,dayGross=0;
   var nets=types.map(function(type){
     var plan=plansFor(day,type)[0];
     if(!plan||plan.unsettled)return null;
     var gross=allocation(plan,1000,'balanced').returns;dayGross+=gross;dayStake+=1000;return gross-1000;
   });
   stakeTotal+=dayStake;grossTotal+=dayGross;
   rows.push('<tr><td>'+esc(day.slice(5))+'</td>'+nets.map(tdNet).join('')+tdNet(dayGross-dayStake)+'</tr>');
 }
 var net=grossTotal-stakeTotal;
 $('dailyReview').innerHTML='<p class="compare-disclaimer">14天，每种玩法每日1000点，所有组合等额。中断的总进球1组未计入已结算投入。</p><div class="compare-table-scroll"><table><thead><tr><th>日期</th><th>方向</th><th>半全场</th><th>总进球</th><th>比分</th><th>当天净盈亏</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div><p class="compare-total">已结算投入 '+money(stakeTotal)+'点 · 模拟返还 '+money(grossTotal)+'点 · 净'+(net>=0?'+':'−')+money(Math.abs(net))+'点</p>';
}
function renderAll(){renderTabs();renderDate();renderPlans();renderHistory();renderCompare();if(state.open)renderDialog()}
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
 if(mode==='balanced')return '所有组合等额分配，方便比较不同选项数量与赔率结构。';
 if(mode==='hot')return '更侧重较低赔率的常规结果。';
 if(mode==='cold')return '更侧重较高赔率的结果。';
 return '兼顾均衡覆盖与常规结果。';
}
function dialogLeg(leg){
 var r=leg.row,pending=!score(r.ft)||!score(r.ht),captured=(mkt(r,leg.market)||{}).captured;
 return '<div class="detail-leg"><b>'+esc(r.num)+'｜'+esc(r.h)+' vs '+esc(r.a)+'</b><small>'+esc(r.league)+'　'+(pending?(r.blindMasked?'历史赛果遮挡':r.blindPending?'比赛中断待结算':'赛前赔率')+(captured?' · 采集于 '+esc(captured.slice(0,10)):''):'FT '+esc(parseScoreText(r))+'　HT '+esc(String(r.ht||'').replace(':','-')))+'</small><div class="chips">'+leg.options.map(function(o){return '<span class="chip '+(pending?'':o.hit?'ok':'no')+'">'+esc(o.name)+' @'+money(o.odds)+(pending?'':o.hit?' ✓':'')+'</span>'}).join('')+'</div></div>';
}
function renderDialog(){
 var q=state.open;if(!q)return;var plan=plansFor(q.day,q.type).find(function(p){return p.index===q.index});if(!plan)return;
 var sim=allocation(plan,state.budget,state.mode),pending=!!plan.prematch,pendingLabel=plan.blind?plan.unsettled?'待结算':'遮挡':'待赛';
 var displayType={direction:'方向',htft:'半全场',goals:'总进球',score:'比分'}[plan.type]||'双场';
 $('dialogTitle').textContent=displayType+(planLegs(plan).length===3?'三场':'双场')+' · 方案'+String(plan.index).padStart(2,'0');
 $('dialogSub').textContent=readableDay(plan.day)+(pending?' · '+(plan.versionLabel||'赛前精选')+' · 官方赛前赔率':' · 历史模拟');
 document.querySelectorAll('#modeTabs button').forEach(function(el){var yes=el.dataset.mode===state.mode;el.classList.toggle('active',yes);el.setAttribute('aria-selected',String(yes))});
 var range=money(sim.grossMin)+'–'+money(sim.grossMax);
 var summary='<div class="summary"><div class="summary-item"><small>模拟金额</small><strong>'+money(state.budget)+'点</strong></div><div class="summary-item"><small>组合选项</small><strong>'+sim.list.length+'种</strong></div><div class="summary-item"><small>'+(pending?'情景返还范围':'模拟返还')+'</small><strong>'+(pending?range:money(sim.returns)+'点')+'</strong></div></div>';
 var rows=sim.list.map(function(c,i){return '<tr class="'+(!pending&&c.hit?'winner':'')+'"><td>'+String(i+1).padStart(2,'0')+'</td><td>'+esc(c.options.map(function(o){return o.name}).join(' × '))+'</td><td>'+money(c.odds)+'</td><td>'+money(c.stake)+'</td><td>'+money(c.projected)+'</td><td>'+(pending?pendingLabel:c.hit?'✓':'—')+'</td></tr>'}).join('');
 $('dialogBody').innerHTML='<div class="dialog-tip">'+esc(strategyDescription(state.mode))+(pending&&plan.versionNote?'｜'+esc(plan.versionNote):'')+'</div><div class="dialog-legs">'+planLegs(plan).map(dialogLeg).join('')+'</div>'+summary+'<div class="alloc-title">组合分配</div><div class="alloc"><table><thead><tr><th>#</th><th>组合</th><th>赔率</th><th>份额</th><th>理论返还</th><th>'+(pending?'状态':'命中')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="disclaimer">'+(pending?'仅为赛前赔率及分配情景模拟。理论返还是假定单一组合满足条件时的计算结果，尚未结算，不代表实际收益，也不构成投注建议。':'历史回溯计算，仅供数据研究。并非赛前实际发布记录，也不代表真实收益。')+'</div>';
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
 var t=['球场档案｜精选方案',p.day+' '+types[p.type].label+' '+(p.versionLabel||'方案'+p.index)];
 planLegs(p).forEach(function(l,i){t.push((i+1)+'. '+l.row.num+' '+l.row.h+' vs '+l.row.a+'：'+l.options.map(function(o){return o.name+' @'+money(o.odds)}).join(' / '))});
 t.push(modes[state.mode]+'｜模拟预算'+money(state.budget)+'点｜组合'+sim.list.length+'种');
 t.push(pending?'赛前赔率与组合演示，尚未结算。':('历史模拟返还'+money(sim.returns)+'点 · 历史回溯演示，非当时赛前发布。'));
 t.push('数据研究，不构成投注建议。');t=t.join('\n');
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){var b=$('copyPlan');b.textContent='已复制';setTimeout(function(){b.textContent='复制方案'},1600)}).catch(function(){window.prompt('复制方案摘要',t)});
 else window.prompt('复制方案摘要',t);
}
function attach(){
 $('revealBlind').addEventListener('click',function(){state.reveal=!state.reveal;state.open=null;renderAll()});
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
 dates=Array.from(new Set(all.map(function(r){return r.d}).concat(Object.keys(db.selectedPlans||{})).concat(Object.keys(blind&&blind.days||{})))).sort().reverse();
 if(!dates.length){$('plans').innerHTML='<div class="empty">暂无可核验的完赛样本。</div>';return}
 state.day=dates[0];state.month=new Date(state.day+'T12:00:00');renderMetrics();attach();renderAll();
}
Promise.resolve(window.QC_CURATED_DB_READY).then(init).catch(function(){init()});
})();