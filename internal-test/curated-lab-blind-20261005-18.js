/* 球场档案 · AI精选师4分类 · 历史赛果遮挡回测
  选择档与结算档独立。选择档先于读取任何比分冻结（见GitHub提交记录）。
  仅作固定规则的历史回放，非当时真实发布或独立样本外评估。 */
(()=>{'use strict';
const blind=window.QC_CURATED_BLIND_SELECTION_V1,settled=window.QC_CURATED_BLIND_SETTLEMENT_V1;
const $=s=>document.getElementById(s);
const labels={direction:'方向精选师',htft:'半全场精选师',goals:'总进球精选师',score:'比分精选师'};
const abbreviations={direction:'方向2串1',htft:'半全场',goals:'总进球',score:'比分'};
const types=Object.keys(labels),dates=Object.keys(blind.days).sort().reverse();
const state={day:dates[0],type:'direction',reveal:false,mode:'balanced',budget:100};
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function odd(x){return Number(x).toFixed(2)}
function roundMoney(x){return (+x).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function dayText(d){const date=new Date(d+'T12:00:00+08:00');return String(+d.slice(5,7))+'月'+(+d.slice(8))+'日 '+['周日','周一','周二','周三','周四','周五','周六'][date.getUTCDay()]}
function ko(r){return new Date(r.ko).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}
function oddsFor(leg,p){return Number(leg.row.mk[leg.market].o[p.key])}
function legs(e){return e.legs.map((l,i)=>{
 const r=l.row,opts=l.picks.map(p=>'<span class="pick">'+esc(p.name)+' <b>×'+odd(oddsFor(l,p))+'</b></span>').join('');
 const outcome=state.reveal?settled.dates[state.day].items.find(x=>x.type===e.type)?.legResults[i]:null;
 const result=outcome?'<div class="outcome-line">半场 '+esc(outcome.ht||'—')+'　全场 '+esc(outcome.ft||'—')+
 '<b class="'+(outcome.hit===null?'await':outcome.hit?'good':'bad')+'">'+(outcome.hit===null?'待结算':outcome.hit?'选项命中':'选项未中')+'</b></div>':'';
 const captured=r.mk[l.market].captured;
 let age=(new Date(r.ko)-new Date(captured))/36e5;
 const old=age>=48?'<span class="stale">赔率距开赛超过48小时</span>':'';
 return '<div class="leg"><div class="leg-top"><span class="num">'+esc(r.num)+'</span><span>'+esc(r.league)+'</span><time>'+esc(ko(r))+'</time></div><div class="fixture">'+esc(r.h)+' <small>vs</small> '+esc(r.a)+'</div><div class="picks">'+opts+'</div><div class="market">官方赛前赔率 · '+esc(l.market.toUpperCase())+' '+old+'</div>'+result+'</div>';
}).join('<div class="times" aria-hidden="true">×</div>')}
function combos(e){let a=e.legs[0],b=e.legs[1],list=[];for(const l of a.picks)for(const r of b.picks)list.push({a:l.name,b:r.name,odds:oddsFor(a,l)*oddsFor(b,r)});
 const weights=list.map(c=>state.mode==='balanced'?1/c.odds:state.mode==='hot'?Math.pow(1/c.odds,1.55):state.mode==='cold'?Math.pow(c.odds,.7):.55/c.odds+.45*Math.pow(1/c.odds,1.55));
 const cents=Math.round(state.budget*100),sum=weights.reduce((s,w)=>s+w,0);
 const raw=weights.map(w=>cents*w/sum),unit=raw.map(Math.floor);
 const gaps=cents-unit.reduce((s,n)=>s+n,0);
 const rank=raw.map((n,i)=>({i,delta:n-Math.floor(n)})).sort((x,y)=>y.delta-x.delta||x.i-y.i);
 for(let n=0;n<gaps;n++)unit[rank[n%rank.length].i]++;
 list.forEach((c,i)=>{c.stake=unit[i]/100;c.projected=c.stake*c.odds});
 return list;
}
function item(e){const combosList=combos(e),m=Math.min(...combosList.map(c=>c.odds)),max=Math.max(...combosList.map(c=>c.odds));
 const observed=state.reveal?settled.dates[state.day].items.find(x=>x.type===e.type):null;
 const status=observed?'<span class="status '+(observed.result==='hit'?'good':observed.result==='miss'?'bad':'await')+'">'+
 (observed.result==='hit'?'已命中':observed.result==='miss'?'未命中':'待结算')+'</span>':'<span class="status masked">赛果已遮挡</span>';
 const risk=e.type==='score'?'<span class="subtle">比分组合风险高，不可视作独立概率保证</span>':'';
 const rows=combosList.map((c,i)=>'<tr><td>'+String(i+1).padStart(2,'0')+'</td><td>'+esc(c.a)+' × '+esc(c.b)+'</td><td>'+odd(c.odds)+'</td><td>'+roundMoney(c.stake)+'</td><td>'+roundMoney(c.projected)+'</td></tr>').join('');
 const candidates=(e.audit.rankedTop5||[]).map((c,i)=>'<span class="candidate">'+(i+1)+'. '+esc(c.num)+' <small>评分'+odd(c.score)+'</small></span>').join('');
 return '<article class="plan"><div class="plan-head"><div><span class="eyebrow">BLIND V1 · 10/05—10/18</span><h3>'+esc(labels[e.type])+'</h3><small>开赛前已锁板 · 双场独立筛选</small></div>'+status+'</div>'+
 '<div class="leg-box">'+legs(e)+'</div><div class="plan-summary"><div><small>组合数量</small><b>'+combosList.length+'种</b></div><div><small>组合赔率</small><b>'+odd(m)+(Math.abs(m-max)>1e-7?'—'+odd(max):'')+'</b></div></div>'+
 '<details class="detail"><summary>展开组合赔率与模拟分配 <span>⌄</span></summary><div class="detail-inner"><div class="detail-tip">默认100点研究预算，可调整模拟金额和分配方式。理论返还仅为条件计算，不代表实际收益。</div>'+
 '<div class="table-wrap"><table><thead><tr><th>#</th><th>组合</th><th>赔率</th><th>模拟份额</th><th>条件返还</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<p class="method-desc">单场候选 '+e.audit.candidateCount+' 场；入选依据：'+esc(e.audit.selectionReason)+'。'+esc(e.audit.riskNotes.join('｜'))+'</p>'+
 '<div class="candidate-box"><b>筛选阶段候选榜（不含赛果）</b><div>'+candidates+'</div></div></div></details>'+risk+'</article>';
}
function render(){
 $('dateChooser').value=state.day;
 $('titleDate').textContent=dayText(state.day);
 $('sourceCount').textContent=blind.days[state.day].eligibleMatches+'场合格赛前FINAL';
 $('tabs').querySelectorAll('[data-type]').forEach(b=>{let active=b.dataset.type===state.type;b.classList.toggle('on',active);b.setAttribute('aria-selected',String(active))});
 $('plans').innerHTML=blind.days[state.day].entries.filter(e=>e.type===state.type).map(item).join('')||'<div class="empty">此类当天无满足条件的场次，不强制凑选。</div>';
 $('revealer').textContent=state.reveal?'隐藏赛果':'揭晓赛果';
 $('revealer').setAttribute('aria-pressed',String(state.reveal));
 $('statusIntro').textContent=state.reveal?'当前已显示独立结算档的数据；选场档案保持冻结。':'选场结果来自锁板数据和赛前赔率；真实赛果默认遮挡，展开后才显示。';
 $('summary').innerHTML=types.map(type=>{const x=settled.summary[type];let denominator=x.n-x.void;
 const detail=state.reveal?'<strong>'+x.h+' / '+denominator+'</strong><small>双场命中 '+(denominator?(x.h/denominator*100).toFixed(1):'—')+'%'+(x.void?' · '+x.void+'组待结算':'')+'</small>':'<strong>—</strong><small>揭晓后查看独立结算</small>';
 return '<div class="summary-card"><span>'+esc(labels[type])+'</span>'+detail+'</div>'}).join('');
}
function start(){
 if(!blind||!settled||!blind.days||!settled.dates){document.body.textContent='精选回测档案尚未加载';return}
 $('dateChooser').innerHTML=dates.map(d=>'<option value="'+esc(d)+'">'+esc(dayText(d))+'</option>').join('');
 $('dateChooser').addEventListener('change',e=>{state.day=e.target.value;render()});
 $('prev').addEventListener('click',()=>{const i=dates.indexOf(state.day);if(i<dates.length-1){state.day=dates[i+1];render()}});
 $('next').addEventListener('click',()=>{const i=dates.indexOf(state.day);if(i>0){state.day=dates[i-1];render()}});
 $('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(b){state.type=b.dataset.type;render()}});
 $('revealer').addEventListener('click',()=>{state.reveal=!state.reveal;render()});
 $('mode').addEventListener('change',e=>{state.mode=e.target.value;render()});
 $('budget').addEventListener('change',e=>{let v=+e.target.value;state.budget=Number.isFinite(v)?Math.max(10,Math.min(100000,Math.round(v*100)/100)):100;e.target.value=state.budget;render()});
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
